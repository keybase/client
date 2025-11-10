import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import ProfileSearch from '../profile/search'

const HeaderAvatar = () => {
  const myUsername = C.useCurrentUserState(s => s.username)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onClick = React.useCallback(() => navigateAppend('accountSwitcher'), [navigateAppend])
  return <Kb.Avatar size={32} username={myUsername} onClick={onClick} />
}

export default {
  getOptions: {
    headerLeft: () => <Kb.HeaderLeftBlank />,
    headerRight: () => <HeaderAvatar />,
    headerTitle: () => <ProfileSearch />,
  },
  screen: React.lazy(async () => import('./container')),
}
