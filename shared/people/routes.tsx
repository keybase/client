import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import peopleTeamBuilder from '../team-building/page'
import ProfileSearch from '../profile/search'
import {useCurrentUserState} from '@/stores/current-user'

const HeaderAvatar = () => {
  const myUsername = useCurrentUserState(s => s.username)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onClick = React.useCallback(() => navigateAppend('accountSwitcher'), [navigateAppend])
  return <Kb.Avatar size={32} username={myUsername} onClick={onClick} />
}

export const newRoutes = {
  peopleRoot: {
    getOptions: {
      headerLeft: () => <Kb.HeaderLeftBlank />,
      headerRight: () => <HeaderAvatar />,
      headerTitle: () => <ProfileSearch />,
    },
    screen: React.lazy(async () => import('./container')),
  },
}

export const newModalRoutes = {
  accountSwitcher: {screen: React.lazy(async () => import('../router-v2/account-switcher'))},
  peopleTeamBuilder,
}

export type RootParamListPeople = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
