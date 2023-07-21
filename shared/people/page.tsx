import * as RouterConstants from '../constants/router2'
import * as React from 'react'
import * as ConfigConstants from '../constants/config'
import * as Kb from '../common-adapters'
import ProfileSearch from '../profile/search/bar'

const HeaderAvatar = () => {
  const myUsername = ConfigConstants.useCurrentUserState(s => s.username)
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onClick = React.useCallback(() => navigateAppend('accountSwitcher'), [navigateAppend])
  return <Kb.Avatar size={32} username={myUsername} onClick={onClick} />
}

const People = React.lazy(async () => import('./container'))

const getOptions = () => ({
  headerLeft: () => <Kb.HeaderLeftBlank />,
  headerRight: () => <HeaderAvatar />,
  headerTitle: () => <ProfileSearch />,
})

const Screen = () => (
  <React.Suspense>
    <People />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
