import { Components, registerComponent } from 'meteor/vulcan:core'
import React from 'react'
import { useCurrentUser } from '../common/withUser'
import Users from 'meteor/vulcan:users'

const EAHome = () => {
  const currentUser = useCurrentUser();
  const { RecentDiscussionThreadsList, HomeLatestPosts, ConfigurableRecommendationsList, } = Components

  const shouldRenderSidebar = Users.canDo(currentUser, 'posts.moderate.all')
  const recentDiscussionCommentsPerPost = (currentUser && currentUser.isAdmin) ? 4 : 3;

  return (
    <React.Fragment>
      {shouldRenderSidebar && <Components.SunshineSidebar/>}

      <HomeLatestPosts />

      <ConfigurableRecommendationsList configName="frontpageEA" />

      <RecentDiscussionThreadsList
        terms={{view: 'recentDiscussionThreadsList', limit:20}}
        commentsLimit={recentDiscussionCommentsPerPost}
        maxAgeHours={18}
        af={false}
      />
    </React.Fragment>
  )
}

const EAHomeComponent = registerComponent('EAHome', EAHome)

declare global {
  interface ComponentTypes {
    EAHome: typeof EAHomeComponent
  }
}