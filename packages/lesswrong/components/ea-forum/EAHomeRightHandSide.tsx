import React, { useRef, useState } from 'react';
import NoSSR from 'react-no-ssr';
import moment from 'moment';
import classNames from 'classnames';
import sortBy from 'lodash/sortBy';
import findIndex from 'lodash/findIndex';
import TextField from '@material-ui/core/TextField';
import { Components, registerComponent } from '../../lib/vulcan-lib';
import { AnalyticsContext, useTracking } from "../../lib/analyticsEvents";
import { Link } from '../../lib/reactRouterWrapper';
import { useCookiesWithConsent } from '../hooks/useCookiesWithConsent';
import { useMulti } from '../../lib/crud/withMulti';
import { useTimezone } from '../common/withTimezone';
import { useCurrentUser } from '../common/withUser';
import { useUpdateCurrentUser } from '../hooks/useUpdateCurrentUser';
import { useMessages } from '../common/withMessages';
import { useUserLocation, userHasEmailAddress } from '../../lib/collections/users/helpers';
import { postGetPageUrl } from '../../lib/collections/posts/helpers';
import { getCityName } from '../localGroups/TabNavigationEventsList';
import { isPostWithForeignId } from '../hooks/useForeignCrosspost';
import { eaForumDigestSubscribeURL } from '../recentDiscussion/RecentDiscussionSubscribeReminder';
import { HIDE_DIGEST_AD_COOKIE } from '../../lib/cookies/cookies';
import { userHasEAHomeRHS } from '../../lib/betas';
import { spotifyLogoIcon } from '../icons/SpotifyLogoIcon';
import { pocketCastsLogoIcon } from '../icons/PocketCastsLogoIcon';
import { applePodcastsLogoIcon } from '../icons/ApplePodcastsLogoIcon';
import { googlePodcastsLogoIcon } from '../icons/GooglePodcastsLogoIcon';


const styles = (theme: ThemeType): JssStyles => ({
  root: {
    paddingLeft: 40,
    paddingRight: 30,
    borderLeft: theme.palette.border.faint,
    marginTop: 30,
    marginLeft: 50,
    '@media(max-width: 1370px)': {
      display: 'none'
    }
  },
  section: {
    maxWidth: 250,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '9px',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 30,
  },
  digestAdSection: {
    maxWidth: 334,
  },
  digestAd: {
    backgroundColor: theme.palette.grey[200],
    padding: '12px 16px',
    borderRadius: theme.borderRadius.default
  },
  digestAdHeadingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    columnGap: 8,
    marginBottom: 12
  },
  digestAdHeading: {
    fontWeight: 600,
    fontSize: 16,
    margin: 0
  },
  digestAdClose: {
    height: 16,
    width: 16,
    color: theme.palette.grey[600],
    cursor: 'pointer',
    '&:hover': {
      color: theme.palette.grey[800],
    }
  },
  digestAdBody: {
    fontSize: 13,
    lineHeight: '19px',
    fontWeight: 500,
    color: theme.palette.grey[600],
    marginBottom: 12
  },
  digestForm: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 8,
    rowGap: '12px'
  },
  digestFormInput: {
    flexGrow: 1,
    background: theme.palette.grey[0],
    borderRadius: theme.borderRadius.default,
    '& .MuiInputLabel-outlined': {
      transform: 'translate(14px,12px) scale(1)',
      '&.MuiInputLabel-shrink': {
        transform: 'translate(14px,-6px) scale(0.75)',
      }
    },
    '& .MuiNotchedOutline-root': {
      borderRadius: theme.borderRadius.default,
    },
    '& .MuiOutlinedInput-input': {
      padding: 11
    }
  },
  sectionTitle: {
    fontSize: 12,
    lineHeight: '16px'
  },
  resourceLink: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: 6,
    color: theme.palette.primary.main,
    fontWeight: 600,
  },
  resourceIcon: {
    height: 16,
    width: 16,
  },
  postTitle: {
    fontWeight: 600,
  },
  postTitleLink: {
    display: 'inline-block',
    maxWidth: '100%',
    overflow: 'hidden',
    whiteSpace: "nowrap",
    textOverflow: 'ellipsis',
  },
  postMetadata: {
    color: theme.palette.text.dim3,
    '& .PostsItemDate-postedAt': {
      fontWeight: 400
    }
  },
  eventDate: {
    display: 'inline-block',
    width: 64
  },
  eventLocation: {
  },
  viewMore: {
    fontWeight: 600,
    color: theme.palette.text.dim3
  },
  podcastApps: {
    display: 'grid',
    gridTemplateColumns: "122px 128px",
    rowGap: '14px',
    marginBottom: 3,
  },
  podcastApp: {
    display: 'flex',
    columnGap: 8,
    alignItems: 'flex-end',
  },
  podcastAppIcon: {
    color: theme.palette.primary.main,
  },
  listenOn: {
    color: theme.palette.text.dim3,
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
    marginBottom: 2
  },
  podcastAppName: {
    fontSize: 12,
    fontWeight: 600,
  }
});

/**
 * This is the Forum Digest ad that appears at the top of the EA Forum home page right hand side.
 * It has some overlap with the Forum Digest ad that appears in "Recent discussion".
 * In particular, both components use currentUser.hideSubscribePoke,
 * so for logged in users, hiding one ad hides the other.
 *
 * See RecentDiscussionSubscribeReminder.tsx for the other component.
 */
const DigestAd = ({classes}: {
  classes: ClassesType,
}) => {
  const [cookies, setCookie] = useCookiesWithConsent([HIDE_DIGEST_AD_COOKIE])
  const currentUser = useCurrentUser()
  const updateCurrentUser = useUpdateCurrentUser()
  const emailRef = useRef<HTMLInputElement|null>(null)
  const [loading, setLoading] = useState(false)
  const [formSubmitted, setFormSubmitted] = useState(false)
  const { flash } = useMessages()
  const { captureEvent } = useTracking()
  
  // if the user just submitted the form, make sure not to hide it, so that it properly finishes submitting
  if (!formSubmitted && (
    // user clicked the X in this ad, or previously submitted the form
    cookies[HIDE_DIGEST_AD_COOKIE] ||
    // user is already subscribed
    currentUser?.subscribedToDigest ||
    // user is logged in and clicked the X in this ad, or "Don't ask again" in the ad in "Recent discussion"
    currentUser?.hideSubscribePoke
  )) {
    return null
  }
  
  // If the user is logged in and has an email address, we just show the "Subscribe" button.
  // Otherwise, we show the form with the email address input.
  const showForm = !currentUser || !userHasEmailAddress(currentUser)
  
  const handleClose = () => {
    captureEvent("digestAdClosed")
    setCookie(HIDE_DIGEST_AD_COOKIE, "true")
    if (currentUser) {
      void updateCurrentUser({hideSubscribePoke: true})
    }
  }
  
  const handleUserSubscribe = async () => {
    setLoading(true)
    captureEvent("digestAdSubscribed")
    
    if (currentUser) {
      try {
        await updateCurrentUser({
          subscribedToDigest: true,
          unsubscribeFromAll: false
        })
        setCookie(HIDE_DIGEST_AD_COOKIE, "true")
        flash('Thanks for subscribing!')
      } catch(e) {
        flash('There was a problem subscribing you to the digest. Please try again later.')
      }
    }
    if (showForm && emailRef.current?.value) {
      setFormSubmitted(true)
      setCookie(HIDE_DIGEST_AD_COOKIE, "true")
    }
    
    setLoading(false)
  }
  
  const { ForumIcon, EAButton } = Components
  
  const buttonProps = loading ? {disabled: true} : {}
  const formNode = showForm ? (
    <form action={eaForumDigestSubscribeURL} method="post" className={classes.digestForm}>
      <TextField
        inputRef={emailRef}
        variant="outlined"
        label="Email address"
        placeholder="example@email.com"
        name="EMAIL"
        required
        className={classes.digestFormInput}
      />
      <EAButton type="submit" onClick={handleUserSubscribe} {...buttonProps}>
        Subscribe
      </EAButton>
    </form>
  ) : (
    <EAButton onClick={handleUserSubscribe} {...buttonProps}>
      Subscribe
    </EAButton>
  )
  
  return <AnalyticsContext pageSubSectionContext="digestAd">
    <div className={classNames(classes.section, classes.digestAdSection)}>
      <div className={classes.digestAd}>
        <div className={classes.digestAdHeadingRow}>
          <h2 className={classes.digestAdHeading}>Get the best posts in your email</h2>
          <ForumIcon icon="Close" className={classes.digestAdClose} onClick={handleClose} />
        </div>
        <div className={classes.digestAdBody}>
          Sign up for the EA Forum Digest to get curated recommendations every week
        </div>
        {formNode}
      </div>
    </div>
  </AnalyticsContext>
}

/**
 * This is a list of upcoming (nearby) events. It uses logic similar to EventsList.tsx.
 */
const UpcomingEventsSection = ({classes}: {
  classes: ClassesType,
}) => {
  const { timezone } = useTimezone()
  const currentUser = useCurrentUser()
  const {lat, lng, known} = useUserLocation(currentUser, true)
  const upcomingEventsTerms: PostsViewTerms = lat && lng && known ? {
    view: 'nearbyEvents',
    lat: lat,
    lng: lng,
    limit: 3,
  } : {
    view: 'globalEvents',
    limit: 3,
  }
  const { results: upcomingEvents } = useMulti({
    collectionName: "Posts",
    terms: upcomingEventsTerms,
    fragmentName: 'PostsList',
    fetchPolicy: 'cache-and-network',
  })
  
  const { SectionTitle, PostsItemTooltipWrapper } = Components
  
  return <AnalyticsContext pageSubSectionContext="upcomingEvents">
    <div className={classes.section}>
      <SectionTitle title="Upcoming events" className={classes.sectionTitle} noTopMargin noBottomPadding />
      {upcomingEvents?.map(event => {
        const shortDate = moment(event.startTime).tz(timezone).format("MMM D")
        return <div key={event._id} className={classes.post}>
          <div className={classes.postTitle}>
            <PostsItemTooltipWrapper post={event} As="span">
              <Link to={postGetPageUrl(event)} className={classes.postTitleLink}>
                {event.title}
              </Link>
            </PostsItemTooltipWrapper>
          </div>
          <div className={classes.postMetadata}>
            <span className={classes.eventDate}>
              {shortDate}
            </span>
            <span className={classes.eventLocation}>
              {event.onlineEvent ? "Online" : getCityName(event)}
            </span>
          </div>
        </div>
      })}
      <div>
        <Link to="/events" className={classes.viewMore}>View more</Link>
      </div>
    </div>
  </AnalyticsContext>
}

/**
 * This is the primary EA Forum home page right-hand side component.
 */
export const EAHomeRightHandSide = ({classes}: {
  classes: ClassesType,
}) => {
  const currentUser = useCurrentUser()
  const { timezone } = useTimezone()

  const now = moment().tz(timezone)
  const dateCutoff = now.subtract(7, 'days').format("YYYY-MM-DD")
  const { results: opportunityPosts } = useMulti({
    collectionName: "Posts",
    terms: {
      view: "magic",
      filterSettings: {tags: [{
        tagId: 'z8qFsGt5iXyZiLbjN',
        filterMode: 'Required'
      }]},
      after: dateCutoff,
      limit: 3
    },
    fragmentName: "PostsList",
    enableTotal: false,
    fetchPolicy: "cache-and-network",
  })
  
  const {results: savedPosts} = useMulti({
    collectionName: "Posts",
    terms: {
      view: "myBookmarkedPosts",
      limit: 3,
    },
    fragmentName: "PostsList",
    fetchPolicy: "cache-and-network",
    skip: !currentUser?._id,
  })
  // HACK: The results are not properly sorted, so we sort them here.
  // See also comments in BookmarksList.tsx and the myBookmarkedPosts view.
  const sortedSavedPosts = sortBy(savedPosts,
    post => -findIndex(
      currentUser?.bookmarkedPostsMetadata || [],
      (bookmark) => bookmark.postId === post._id
    )
  )
  
  // Currently, this is only visible to beta users.
  if (!userHasEAHomeRHS(currentUser)) return null

  const { SectionTitle, PostsItemTooltipWrapper, PostsItemDate, ForumIcon } = Components
  
  // NoSSR sections that could affect the logged out user cache
  let digestAdNode = <DigestAd classes={classes} />
  let upcomingEventsNode = <UpcomingEventsSection classes={classes} />
  if (!currentUser) {
    digestAdNode = <NoSSR>{digestAdNode}</NoSSR>
    upcomingEventsNode = <NoSSR>{upcomingEventsNode}</NoSSR>
  }

  const podcastPost = '/posts/K5Snxo5EhgmwJJjR2/announcing-ea-forum-podcast-audio-narrations-of-ea-forum'

  return <AnalyticsContext pageSectionContext="homeRhs">
    <div className={classes.root}>
      {digestAdNode}
      
      <AnalyticsContext pageSubSectionContext="resources">
        <div className={classes.section}>
          <SectionTitle title="Resources" className={classes.sectionTitle} noTopMargin noBottomPadding />
          <div>
            <Link to="/handbook" className={classes.resourceLink}>
              <ForumIcon icon="BookOpen" className={classes.resourceIcon} />
              The EA Handbook
            </Link>
          </div>
          <div>
            <Link to="https://www.effectivealtruism.org/virtual-programs/introductory-program" className={classes.resourceLink}>
              <ForumIcon icon="ComputerDesktop" className={classes.resourceIcon} />
              The Introductory EA Program
            </Link>
          </div>
          <div>
            <Link to="/groups" className={classes.resourceLink}>
              <ForumIcon icon="Users" className={classes.resourceIcon} />
              Discover EA groups
            </Link>
          </div>
        </div>
      </AnalyticsContext>
      
      {!!opportunityPosts?.length && <AnalyticsContext pageSubSectionContext="opportunities">
        <div className={classes.section}>
          <SectionTitle title="Opportunities" className={classes.sectionTitle} noTopMargin noBottomPadding />
          {opportunityPosts?.map(post => <div key={post._id} className={classes.post}>
            <div className={classes.postTitle}>
              <PostsItemTooltipWrapper post={post} As="span">
                <Link to={postGetPageUrl(post)} className={classes.postTitleLink}>
                  {post.title}
                </Link>
              </PostsItemTooltipWrapper>
            </div>
            <div className={classes.postMetadata}>
              Posted <PostsItemDate post={post} includeAgo />
            </div>
          </div>)}
          <div>
            <Link to="/topics/opportunities-to-take-action" className={classes.viewMore}>View more</Link>
          </div>
        </div>
      </AnalyticsContext>}
      
      {upcomingEventsNode}
      
      {!!sortedSavedPosts?.length && <AnalyticsContext pageSubSectionContext="savedPosts">
        <div className={classes.section}>
          <SectionTitle title="Saved posts" className={classes.sectionTitle} noTopMargin noBottomPadding />
          {sortedSavedPosts.map(post => {
            let postAuthor = '[anonymous]'
            if (post.user && !post.hideAuthor) {
              postAuthor = post.user.displayName
            }
            const readTime = isPostWithForeignId(post) ? '' : `, ${post.readTimeMinutes} min`
            return <div key={post._id} className={classes.post}>
              <div className={classes.postTitle}>
                <PostsItemTooltipWrapper post={post} As="span">
                  <Link to={postGetPageUrl(post)} className={classes.postTitleLink}>
                    {post.title}
                  </Link>
                </PostsItemTooltipWrapper>
              </div>
              <div className={classes.postMetadata}>
                {postAuthor}{readTime}
              </div>
            </div>
          })}
          <div>
            <Link to="/saved" className={classes.viewMore}>View more</Link>
          </div>
        </div>
      </AnalyticsContext>}
      
      <AnalyticsContext pageSubSectionContext="podcasts">
        <div className={classes.section}>
          <SectionTitle title="Listen to posts anywhere" className={classes.sectionTitle} noTopMargin noBottomPadding />
          <div className={classes.podcastApps}>
            <Link to="https://open.spotify.com/show/2Ki0q34zEthDfKUB56kcxH" target="_blank" rel="noopener noreferrer" className={classes.podcastApp}>
              <div className={classes.podcastAppIcon}>{spotifyLogoIcon}</div>
              <div>
                <div className={classes.listenOn}>Listen on</div>
                <div className={classes.podcastAppName}>Spotify</div>
              </div>
            </Link>
            <Link to="https://podcasts.apple.com/us/podcast/1657526204" target="_blank" rel="noopener noreferrer" className={classes.podcastApp}>
              <div className={classes.podcastAppIcon}>{applePodcastsLogoIcon}</div>
              <div>
                <div className={classes.listenOn}>Listen on</div>
                <div className={classes.podcastAppName}>Apple Podcasts</div>
              </div>
            </Link>
            <Link to="https://pca.st/zlt4n89d" target="_blank" rel="noopener noreferrer" className={classes.podcastApp}>
              <div className={classes.podcastAppIcon}>{pocketCastsLogoIcon}</div>
              <div>
                <div className={classes.listenOn}>Listen on</div>
                <div className={classes.podcastAppName}>Pocket Casts</div>
              </div>
            </Link>
            <Link
              to="https://podcasts.google.com/feed/aHR0cHM6Ly9mb3J1bS1wb2RjYXN0cy5lZmZlY3RpdmVhbHRydWlzbS5vcmcvZWEtZm9ydW0tLWFsbC1hdWRpby5yc3M"
              target="_blank" rel="noopener noreferrer"
              className={classes.podcastApp}
            >
              <div className={classes.podcastAppIcon}>{googlePodcastsLogoIcon}</div>
              <div>
                <div className={classes.listenOn}>Listen on</div>
                <div className={classes.podcastAppName}>Google Podcasts</div>
              </div>
            </Link>
          </div>
          <div>
            <Link to={podcastPost} className={classes.viewMore}>View more</Link>
          </div>
        </div>
      </AnalyticsContext>
    </div>
  </AnalyticsContext>
}

const EAHomeRightHandSideComponent = registerComponent('EAHomeRightHandSide', EAHomeRightHandSide, {styles});

declare global {
  interface ComponentTypes {
    EAHomeRightHandSide: typeof EAHomeRightHandSideComponent
  }
}
