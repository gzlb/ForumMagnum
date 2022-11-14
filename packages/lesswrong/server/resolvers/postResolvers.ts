import { Posts } from '../../lib/collections/posts/collection';
import { sideCommentFilterMinKarma } from '../../lib/collections/posts/constants';
import { Comments } from '../../lib/collections/comments/collection';
import { SideCommentsCache, SideCommentsResolverResult, sideCommentCacheVersion } from '../../lib/collections/posts/schema';
import { augmentFieldsDict, denormalizedField } from '../../lib/utils/schemaUtils'
import { getLocalTime } from '../mapsUtils'
import { Utils } from '../../lib/vulcan-lib/utils';
import { getDefaultPostLocationFields } from '../posts/utils'
import { addBlockIDsToHTML, getSideComments, matchSideComments } from '../sideComments';
import { captureException } from '@sentry/core';
import { getToCforPost } from '../tableOfContents';
import GraphQLJSON from 'graphql-type-json';

augmentFieldsDict(Posts, {
  // Compute a denormalized start/end time for events, accounting for the
  // timezone the event's location is in. This is subtly wrong: it computes a
  // correct timestamp, but then the timezone part of that timezone gets lost
  // on the way in/out of the database, so if you use this field, what you're
  // getting is "local time mislabeled as UTC".
  localStartTime: {
    ...denormalizedField({
      needsUpdate: (data) => ('startTime' in data || 'googleLocation' in data),
      getValue: async (post) => {
        if (!post.startTime) return null
        const googleLocation = post.googleLocation || (await getDefaultPostLocationFields(post)).googleLocation
        if (!googleLocation) return null
        return await getLocalTime(post.startTime, googleLocation)
      }
    })
  },
  localEndTime: {
    ...denormalizedField({
      needsUpdate: (data) => ('endTime' in data || 'googleLocation' in data),
      getValue: async (post) => {
        if (!post.endTime) return null
        const googleLocation = post.googleLocation || (await getDefaultPostLocationFields(post)).googleLocation
        if (!googleLocation) return null
        return await getLocalTime(post.endTime, googleLocation)
      }
    })
  },
  tableOfContents: {
    resolveAs: {
      type: GraphQLJSON,
      resolver: async (document: DbPost, args: void, context: ResolverContext) => {
        try {
          return await getToCforPost({document, version: null, context});
        } catch(e) {
          captureException(e);
          return null;
        }
    },
    },
  },
  tableOfContentsRevision: {
    resolveAs: {
      type: GraphQLJSON,
      arguments: 'version: String',
      resolver: async (document: DbPost, args: {version:string}, context: ResolverContext) => {
        const { version=null } = args;
        try {
          return await getToCforPost({document, version, context});
        } catch(e) {
          captureException(e);
          return null;
        }
      },
    }
  },
  sideComments: {
    resolveAs: {
      type: GraphQLJSON,
      resolver: async (post: DbPost, args: void, context: ResolverContext): Promise<SideCommentsResolverResult> => {
        const cache = post.sideCommentsCache as SideCommentsCache|undefined;
        const cacheIsValid = cache
          && cache.generatedAt>post.lastCommentedAt
          && cache.generatedAt > post.contents?.editedAt
          && cache.version === sideCommentCacheVersion;
        let unfilteredResult: {annotatedHtml: string, commentsByBlock: Record<string,string[]>}|null = null;
        
        const now = new Date();
        const comments = await Comments.find({
          ...Comments.defaultView({}).selector,
          postId: post._id,
        }).fetch();
        
        if (cacheIsValid) {
          unfilteredResult = {annotatedHtml: cache.annotatedHtml, commentsByBlock: cache.commentsByBlock};
        } else {
          const toc = await getToCforPost({document: post, version: null, context});
          const html = toc?.html || post?.contents?.html
          const sideCommentMatches = await matchSideComments({
            postId: post._id,
            html: html,
            comments: comments.map(comment => ({_id: comment._id, html: comment.contents?.html ?? ""})),
          });
          
          const newCacheEntry = {
            version: sideCommentCacheVersion,
            generatedAt: now,
            annotatedHtml: sideCommentMatches.html,
            commentsByBlock: sideCommentMatches.sideCommentsByBlock,
          }
          
          await Posts.rawUpdateOne({_id: post._id}, {$set: {"sideCommentsCache": newCacheEntry}});
          unfilteredResult = {
            annotatedHtml: sideCommentMatches.html,
            commentsByBlock: sideCommentMatches.sideCommentsByBlock
          };
        }

        const alwaysShownIds = new Set<string>([]);
        alwaysShownIds.add(post.userId);
        if (post.coauthorStatuses) {
          for (let {userId} of post.coauthorStatuses) {
            alwaysShownIds.add(userId);
          }
        }

        const highKarmaComments: DbComment[] = comments.filter(comment =>
          comment.baseScore >= sideCommentFilterMinKarma
          || alwaysShownIds.has(comment.userId)
        );
        const highKarmaCommentIds: Set<string> = new Set(highKarmaComments.map(c => c._id));
        let highKarmaCommentsByBlock: Record<string,string[]> = {};
        for (let blockID of Object.keys(unfilteredResult.commentsByBlock)) {
          const commentsIdsHere = unfilteredResult.commentsByBlock[blockID];
          const highKarmaCommentIdsHere = commentsIdsHere.filter(commentId => highKarmaCommentIds.has(commentId));
          if (highKarmaCommentIdsHere.length > 0) {
            highKarmaCommentsByBlock[blockID] = highKarmaCommentIdsHere;
          }
        }
        
        return {
          html: unfilteredResult.annotatedHtml,
          commentsByBlock: unfilteredResult.commentsByBlock,
          highKarmaCommentsByBlock: highKarmaCommentsByBlock,
        }
      }
    },
  },
})
