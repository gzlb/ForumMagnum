import { Posts } from '../../lib/collections/posts'
import { userIsAdmin, userIsMemberOf } from '../../lib/vulcan-users/permissions';
import { DatabasePublicSetting } from '../../lib/publicSettings';
import { getCollectionHooks } from '../mutationCallbacks';
import Comments from '../../lib/collections/comments/collection';
import { MODERATOR_ACTION_TYPES, RATE_LIMIT_THREE_COMMENTS_PER_POST_PER_WEEK } from '../../lib/collections/moderatorActions/schema';
import { getModeratorRateLimit, getTimeframeForRateLimit, userHasActiveModeratorActionOfType } from '../../lib/collections/moderatorActions/helpers';
import { isInFuture } from '../../lib/utils/timeUtil';
import moment from 'moment';
import Users from '../../lib/collections/users/collection';
import { captureEvent } from '../../lib/analyticsEvents';
import { isEAForum } from '../../lib/instanceSettings';


const postIntervalSetting = new DatabasePublicSetting<number>('forum.postInterval', 30) // How long users should wait between each posts, in seconds
const maxPostsPer24HoursSetting = new DatabasePublicSetting<number>('forum.maxPostsPerDay', 5) // Maximum number of posts a user can create in a day

// Rate limit the number of comments a user can post per 30 min if they have under this much karma
const commentRateLimitKarmaThresholdSetting = new DatabasePublicSetting<number|null>('commentRateLimitKarmaThreshold', null)
// Rate limit the number of comments a user can post per 30 min if their ratio of downvotes received : total votes received is higher than this
const commentRateLimitDownvoteRatioSetting = new DatabasePublicSetting<number|null>('commentRateLimitDownvoteRatio', null)

// Post rate limiting
getCollectionHooks("Posts").createValidate.add(async function PostsNewRateLimit (validationErrors, { newDocument: post, currentUser }) {
  if (!post.draft) {
    await enforcePostRateLimit(currentUser!);
  }
  
  return validationErrors;
});

getCollectionHooks("Posts").updateValidate.add(async function PostsUndraftRateLimit (validationErrors, { oldDocument, newDocument, currentUser }) {
  // Only undrafting is rate limited, not other edits
  if (oldDocument.draft && !newDocument.draft) {
    await enforcePostRateLimit(currentUser!);
  }
  
  return validationErrors;
});

const commentIntervalSetting = new DatabasePublicSetting<number>('commentInterval', 8) // How long users should wait in between comments (in seconds)
getCollectionHooks("Comments").createValidate.add(async function CommentsNewRateLimit (validationErrors, { newDocument: comment, currentUser }) {
  if (!currentUser) {
    throw new Error(`Can't comment while logged out.`);
  }
  await enforceCommentRateLimit({user: currentUser, comment});

  return validationErrors;
});

getCollectionHooks("Comments").createAsync.add(async ({document}: {document: DbComment}) => {
  const user = await Users.findOne(document.userId)
  
  if (user) {
    const rateLimit = await rateLimitDateWhenUserNextAbleToComment(user, null)
    // if the user has created a comment that makes them hit the rate limit, record an event
    // (ignore the universal 8 sec rate limit)
    if (rateLimit && rateLimit.rateLimitType !== 'universal') {
      captureEvent("commentRateLimitHit", {
        rateLimitType: rateLimit.rateLimitType,
        userId: document.userId,
        commentId: document._id
      })
    }
  }
})

export const getNthMostRecentItemDate = async function<
  T extends DbObject & {createdAt:Date}
>({user, collection, cutoffHours, n, filter}: {
  user: DbUser,
  collection: CollectionBase<T>,
  n: number,
  cutoffHours?: number,
  filter?: MongoSelector<T>
}): Promise<Date|null> {
  var mNow = moment();
  const items = await collection.find({
    userId: user._id,
    ...filter,
    ...(cutoffHours && {
      createdAt: {
        $gte: mNow.subtract(cutoffHours, 'hours').toDate(),
      },
    })
  }, {
    sort: ({createdAt: -1} as Partial<Record<keyof T,number>>),
    limit: n,
    projection: {createdAt:1},
  }).fetch();

  if (items.length < n)
    return null;
  else
    return items[n-1].createdAt;

};


// Check whether the given user can post a post right now. If they can, does
// nothing; if they would exceed a rate limit, throws an exception.
async function enforcePostRateLimit (user: DbUser) {
  const rateLimit = await rateLimitDateWhenUserNextAbleToPost(user);
  if (rateLimit) {
    const {nextEligible} = rateLimit;
    if (nextEligible > new Date()) {
      throw new Error(`Rate limit: You cannot post until ${nextEligible}`);
    }
  }
}

async function getCommentsInTimeframe (userId: string, maxTimeframe: number, postId?: string) {
  const commentsInTimeframe = await Comments.find(
    { userId: userId, 
      postId: postId ? postId : null,
      postedAt: {$gte: moment().subtract(maxTimeframe, 'hours').toDate()}
    }, {
      sort: {postedAt: -1}, 
      projection: {postId: 1, postedAt: 1}
    }
  ).fetch()
  return commentsInTimeframe
}

const userCommentsOnOthersPostsInPastTimeframe = async (comments: Array<DbComment>, user: DbUser, hours: number) => {
  const mNow = moment();
  const postIds = comments.map(comment => comment.postId)
  const postsNotAuthoredByCommenter = await Posts.find(
    { _id: {$in: postIds}, $or: [{userId: {$ne: user._id}}, {"coauthorStatuses.userId": {$ne: user._id}}]}, {projection: {_id:1}
  }).fetch()
  const postsNotAuthoredByCommenterIds = postsNotAuthoredByCommenter.map(post => post._id)
  const commentsOnNonauthorPosts = comments.filter(comment => postsNotAuthoredByCommenterIds.includes(comment.postId))
  return commentsOnNonauthorPosts
}

/**
 * Checks if the user is exempt from commenting rate limits (optionally, for the given post).
 *
 * Admins and mods are always exempt.
 * If the post has "ignoreRateLimits" set, then all users are exempt.
 * On forums other than the EA Forum, the post author is always exempt on their own posts.
 */
async function shouldIgnoreCommentRateLimit (user: DbUser, postId: string | null): Promise<boolean> {
  if (userIsAdmin(user) || userIsMemberOf(user, "sunshineRegiment")) {
    return true
  }
  if (postId) {
    const post = await Posts.findOne({_id: postId})
    const commenterIsPostAuthor = post && user._id === post.userId
    if (post?.ignoreRateLimits || (!isEAForum && commenterIsPostAuthor)) {
      return true
    }
  }
  return false
}


async function enforceCommentRateLimit({user, comment}:{user: DbUser, comment: DbComment}) {
  const rateLimit = await rateLimitDateWhenUserNextAbleToComment(user, comment.postId);
  if (rateLimit) {
    const {nextEligible, rateLimitType:_} = rateLimit;
    if (nextEligible > new Date()) {
      throw new Error(`Rate limit: You cannot comment for ${moment(nextEligible).fromNow()} (until ${nextEligible})`);
    }
  }
  
  if (comment.postId) {
    const postSpecificRateLimit = await rateLimitGetPostSpecificCommentLimit(user, comment.postId);
    if (postSpecificRateLimit) {
      const {nextEligible, rateLimitType:_} = postSpecificRateLimit;
      if (nextEligible > new Date()) {
        throw new Error(`Rate limit: You cannot comment on this post until ${nextEligible}`);
      }
    }
  }
}

function getNextAbleToPostDate (posts: Array<DbPost>, intervalType: "seconds"|"hours", intervalAmount: number): Date|null {
  const latestPostInInterval = posts.filter(post => post.postedAt > moment().subtract(intervalAmount, intervalType).toDate()).pop()
  if (!latestPostInInterval) return null
  return moment(latestPostInInterval.postedAt).add(intervalAmount, intervalType).toDate()
}

export type RateLimitType = "moderator"|"lowKarma"|"universal"|"downvoteRatio"

export type RateLimitInfo = {
  nextEligible: Date,
  rateLimitType: RateLimitType,
  rateLimitMessage: string,
}

export async function rateLimitDateWhenUserNextAbleToPost(user: DbUser): Promise<RateLimitInfo|null> {
  const highestStandardRateLimitHours = 24

  // Admins and Sunshines aren't rate-limited
  if (userIsAdmin(user) || userIsMemberOf(user, "sunshineRegiment") || userIsMemberOf(user, "canBypassPostRateLimit"))
    return null;
  
  // does the user have a moderator-assigned rate limit?
  const moderatorRateLimit = await getModeratorRateLimit(user)
  const moderatorRateLimitHours = moderatorRateLimit && getTimeframeForRateLimit(moderatorRateLimit?.type)

  // what's the longest rate limit timeframe being evaluated?
  const maxTimeframe = moderatorRateLimit ? moderatorRateLimitHours : highestStandardRateLimitHours

  // fetch the posts from within the maxTimeframe
  const postsInTimeframe = await Posts.find({
    userId:user._id, 
    draft: false,
    postedAt: {$gte: moment().subtract(maxTimeframe, 'hours').toDate()}
  }, {sort: {postedAt: -1}, projection: {postedAt: 1}}).fetch()

  const modLimitNextPostDate = moderatorRateLimitHours ? getNextAbleToPostDate(postsInTimeframe, "hours", moderatorRateLimitHours) : null
  
  const dailyLimitNextPostDate = getNextAbleToPostDate(postsInTimeframe, "hours", maxPostsPer24HoursSetting.get())
  
  const doublePostLimitNextPostDate = getNextAbleToPostDate(postsInTimeframe, "seconds", postIntervalSetting.get())
  const nextAbleToPostDates = [modLimitNextPostDate, dailyLimitNextPostDate, doublePostLimitNextPostDate]

  if (modLimitNextPostDate && nextAbleToPostDates.every(date => modLimitNextPostDate >= (date ?? new Date()))) {
    return {
      nextEligible: modLimitNextPostDate,
      rateLimitMessage: "A moderator has rate limited you.",
      rateLimitType: "moderator"
    }
  }

  if (dailyLimitNextPostDate && nextAbleToPostDates.every(date => dailyLimitNextPostDate >= (date ?? new Date()))) {
    return {
      nextEligible: dailyLimitNextPostDate,
      rateLimitMessage: `Users cannot submit more than ${maxPostsPer24HoursSetting.get()} per day.`,
      rateLimitType: "universal"
    }
  }

  if (doublePostLimitNextPostDate && nextAbleToPostDates.every(date => doublePostLimitNextPostDate >= (date ?? new Date()))) {
    return {
      nextEligible: doublePostLimitNextPostDate,
      rateLimitMessage: `Users cannot submit more than 1 post per ${postIntervalSetting.get()} seconds.`,
      rateLimitType: "universal"
    }
  }
  return null
}

export async function rateLimitDateWhenUserNextAbleToComment2(user: DbUser, postId?: string): Promise<RateLimitInfo|null> {
  const highestStandardRateLimitHours = 24

  // does the user have a moderator-assigned rate limit?
  const moderatorRateLimit = await getModeratorRateLimit(user)
  const moderatorRateLimitHours = moderatorRateLimit ? getTimeframeForRateLimit(moderatorRateLimit?.type) : 0

  // what's the longest rate limit timeframe being evaluated?
  const maxTimeframe = moderatorRateLimit ? moderatorRateLimitHours : highestStandardRateLimitHours

  // fetch the comments from within the maxTimeframe
  

  const commentsInTimeframe = getCommentsInTimeframe(user._id, maxTimeframe, postId)
  

  return null
}

/**
 * Check if the user has a commenting rate limit due to having low karma.
 */
const checkLowKarmaCommentRateLimit = (user: DbUser): boolean => {
  const karmaThreshold = commentRateLimitKarmaThresholdSetting.get()
  return karmaThreshold !== null && user.karma < karmaThreshold
}

/**
 * Check if the user has a commenting rate limit due to having a high % of their received votes be downvotes.
 */
const checkDownvoteRatioCommentRateLimit = (user: DbUser): boolean => {
  // First check if the sum of the individual vote count fields
  // add up to something close (with 5%) to the voteReceivedCount field.
  // (They should be equal, but we know there are bugs around counting votes,
  // so to be fair to users we don't want to rate limit them if it's too buggy.)
  const sumOfVoteCounts = user.smallUpvoteReceivedCount + user.bigUpvoteReceivedCount + user.smallDownvoteReceivedCount + user.bigDownvoteReceivedCount;
  const denormalizedVoteCountSumDiff = Math.abs(sumOfVoteCounts - user.voteReceivedCount);
  const voteCountsAreValid = user.voteReceivedCount > 0
    && (denormalizedVoteCountSumDiff / user.voteReceivedCount) <= 0.05;
  
  const totalDownvoteCount = user.smallDownvoteReceivedCount + user.bigDownvoteReceivedCount;
  // If vote counts are not valid (i.e. they are negative or voteReceivedCount is 0), then do nothing
  const downvoteRatio = voteCountsAreValid ? (totalDownvoteCount / user.voteReceivedCount) : 0
  const downvoteRatioThreshold = commentRateLimitDownvoteRatioSetting.get()
  const aboveDownvoteRatioThreshold = downvoteRatioThreshold !== null && downvoteRatio > downvoteRatioThreshold

  return aboveDownvoteRatioThreshold
}

/**
 * If the user is rate-limited, return the date/time they will next be able to
 * comment. If they can comment now, returns null.
 */
export async function rateLimitDateWhenUserNextAbleToComment(user: DbUser, postId: string | null): Promise<RateLimitInfo|null> {
  // if this user is a mod/admin or (on non-EAF forums) is the post author,
  // then they are exempt from all rate limits except for the "universal" 8 sec one
  const ignoreRateLimits = await shouldIgnoreCommentRateLimit(user, postId)
  
  if (!ignoreRateLimits) {
    // If moderators have imposed a rate limit on this user, enforce that 
    const moderatorRateLimit = await getModeratorRateLimit(user)
    if (moderatorRateLimit) {
      const hours = getTimeframeForRateLimit(moderatorRateLimit.type)

      // moderatorRateLimits should only apply to comments on posts by people other than the comment author
      const commentsInPastTimeframe = await userCommentsOnOthersPostsInPastTimeframe(user, hours)
    
      if (commentsInPastTimeframe.length > 0) {
        throw new Error(MODERATOR_ACTION_TYPES[moderatorRateLimit.type]);
      }

      const mostRecentInTimeframe = await getNthMostRecentItemDate({
        user, collection: Comments,
        n: 1,
        cutoffHours: hours,
      });
      if (mostRecentInTimeframe) {
        return {
          nextEligible: moment(mostRecentInTimeframe).add(hours, 'hours').toDate(),
          rateLimitType: "moderator",
          rateLimitMessage: "A moderator has rate limited you."
        }
      }
    }
    
    // If the user has low karma, or their ratio of received downvotes to total votes is too high,
    // they are limited to no more than 4 comments per 0.5 hours.
    const hasLowKarma = checkLowKarmaCommentRateLimit(user)
    const hasHighDownvoteRatio = checkDownvoteRatioCommentRateLimit(user)
    if (hasLowKarma || hasHighDownvoteRatio) {
      const fourthMostRecentCommentDate = await getNthMostRecentItemDate({
        user,
        collection: Comments,
        n: 4,
        cutoffHours: 0.5,
      })
      if (fourthMostRecentCommentDate) {
        // if the user has hit the limit, then they are eligible to comment again
        // 30 min after their fourth most recent comment
        const nextEligible = moment(fourthMostRecentCommentDate).add(0.5, 'hours').toDate()
        const rateLimitType: RateLimitType = hasLowKarma ? "lowKarma" : "downvoteRatio";

        const rateLimitMessage = hasLowKarma 
          ? "You'll be able to post more comments as your karma increases." 
          : ""

        return {
          nextEligible,
          rateLimitType,
          rateLimitMessage
        }
      }
    }
  }

  const commentInterval = Math.abs(parseInt(""+commentIntervalSetting.get()));
  // check that user waits more than 8 seconds between comments
  const mostRecentCommentDate = await getNthMostRecentItemDate({
    user, collection: Comments,
    n: 1,
    cutoffHours: commentInterval/(60.0*60.0)
  });
  if (mostRecentCommentDate) {
    return {
      nextEligible: moment(mostRecentCommentDate).add(commentInterval, 'seconds').toDate(),
      rateLimitType: "universal",
      rateLimitMessage: `All users need to wait ${commentInterval} seconds between comments to prevent double-commenting`
    };
  }
  
  
  return null;
}

export async function rateLimitGetPostSpecificCommentLimit(user: DbUser, postId: string): Promise<RateLimitInfo|null> {
  if (await shouldIgnoreCommentRateLimit(user, postId)) {
    return null
  }

  if (postId && await userHasActiveModeratorActionOfType(user, RATE_LIMIT_THREE_COMMENTS_PER_POST_PER_WEEK)) {
    const hours = 24 * 7
    const num_comments = 3
    const thirdMostRecentCommentDate = await getNthMostRecentItemDate({
      user, collection: Comments,
      n: num_comments,
      cutoffHours: hours,
      filter: { postId },
    });
    if (thirdMostRecentCommentDate) {
      return {
        nextEligible: moment(thirdMostRecentCommentDate).add(hours, 'hours').toDate(),
        rateLimitType: "moderator",
        rateLimitMessage: "A moderator has rate limited your ability to comment more than three times per post per week."
      };
    }
  }
  return null;
}
