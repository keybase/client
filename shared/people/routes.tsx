import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import peopleTeamBuilder from '../team-building/page'
import ProfileSearch from '../profile/search'
import {useCurrentUserState} from '@/stores/current-user'
import {settingsLogOutTab} from '@/constants/settings'

const HeaderAvatar = () => {
  const myUsername = useCurrentUserState(s => s.username)
  const navigateAppend = C.Router2.navigateAppend
  const onClick = () => navigateAppend('accountSwitcher')
  return <Kb.Avatar size={32} username={myUsername} onClick={onClick} />
}

export const newRoutes = {
  peopleRoot: {
    getOptions: {
      headerRight: Kb.Styles.isMobile ? () => <HeaderAvatar /> : undefined,
      headerTitle: () => <ProfileSearch />,
    },
    screen: React.lazy(async () => import('./container')),
  },
}

const AccountSignOutButton = () => {
  const navigateAppend = C.Router2.navigateAppend
  return (
    <Kb.Text
      type="BodyBigLink"
      onClick={() => navigateAppend(settingsLogOutTab)}
      style={{color: Kb.Styles.globalColors.red, padding: 8}}
    >
      Sign out
    </Kb.Text>
  )
}

export const newModalRoutes = {
  accountSwitcher: {
    getOptions: {headerRight: () => <AccountSignOutButton />},
    screen: React.lazy(async () => import('../router-v2/account-switcher')),
  },
  peopleTeamBuilder,
}
