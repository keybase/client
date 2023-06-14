import * as React from 'react'
import * as Container from '../util/container'
import * as ConfigConstants from '../constants/config'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Kb from '../common-adapters'
import ProfileSearch from '../profile/search/bar'

const HeaderAvatar = () => {
  const myUsername = ConfigConstants.useCurrentUserState(s => s.username)
  const dispatch = Container.useDispatch()
  const onClick = React.useCallback(
    () => dispatch(RouteTreeGen.createNavigateAppend({path: ['accountSwitcher']})),
    [dispatch]
  )
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
