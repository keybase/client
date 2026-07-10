import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import peopleTeamBuilder from '../team-building/page'
import ProfileSearch from '../profile/search'
import {useCurrentUserState} from '@/stores/current-user'
import {settingsLogOutTab} from '@/constants/settings'
import {defineRouteMap} from '@/constants/types/router'

const HeaderAvatar = () => {
  const myUsername = useCurrentUserState(s => s.username)
  const navigateAppend = C.Router2.navigateAppend
  const onClick = () => navigateAppend({name: 'accountSwitcher', params: {}})
  return <Kb.Avatar size={32} username={myUsername} onClick={onClick} testID={TestIDs.PEOPLE_HEADER_AVATAR} />
}

export const newRoutes = defineRouteMap({
  peopleRoot: {
    getOptions: {
      // iOS 26: hidesSharedBackground prevents the glass circle around the avatar
      ...(isIOS
        ? {
            unstable_headerRightItems: () => [
              {element: <HeaderAvatar />, hidesSharedBackground: true, type: 'custom' as const},
            ],
          }
        : {headerRight: isMobile ? () => <HeaderAvatar /> : undefined}),
      headerTitle: () => <ProfileSearch />,
    },
    screen: React.lazy(async () => import('./container')),
  },
})

const onSignOut = () => {
  C.Router2.navigateAppend({name: settingsLogOutTab, params: {}})
}

const AccountSignOutButton = () => (
  <Kb.Text type="BodyBigLink" onClick={onSignOut} style={styles.signOut}>
    Sign out
  </Kb.Text>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  signOut: {color: Kb.Styles.globalColors.red, padding: 8},
}))

export const newModalRoutes = defineRouteMap({
  accountSwitcher: {
    getOptions: isIOS
      ? {
          unstable_headerRightItems: () => [
            Kb.nativeTextHeaderItem('Sign out', onSignOut, {
              labelStyle: {...Kb.nativeHeaderItemLabelStyle(), color: Kb.Styles.globalColors.red},
            }),
          ],
        }
      : {headerRight: () => <AccountSignOutButton />},
    screen: React.lazy(async () => import('../router-v2/account-switcher')),
  },
  peopleTeamBuilder,
})
