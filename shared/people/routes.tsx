import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import peopleTeamBuilder from '../team-building/page'
import ProfileSearch from '../profile/search'
import {settingsLogOutTab} from '@/constants/settings'
import {defineRouteMap} from '@/constants/types/router'

export const newRoutes = defineRouteMap({
  peopleRoot: {
    getOptions: {
      headerTitle: () => <ProfileSearch />,
    },
    screen: React.lazy(async () => import('./container')),
  },
})

const onSignOut = () => {
  C.Router2.navigateAppend({name: settingsLogOutTab, params: {}})
}

const AccountSignOutButton = () => {
  const styles = useStyles()
  return (
    <Kb.Text type="BodyBigLink" onClick={onSignOut} style={styles.signOut}>
      Sign out
    </Kb.Text>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  signOut: {color: theme.red, padding: 8},
}))

export const newModalRoutes = defineRouteMap({
  accountSwitcher: {
    getOptions: isIOS
      ? {
          unstable_headerRightItems: () => {
            const theme = Kb.Styles.getTheme()
            return [
              Kb.nativeTextHeaderItem('Sign out', onSignOut, {
                labelStyle: {...Kb.nativeHeaderItemLabelStyle(theme), color: theme.red},
              }),
            ]
          },
        }
      : {headerRight: () => <AccountSignOutButton />},
    screen: React.lazy(async () => import('../router-v2/account-switcher')),
  },
  peopleTeamBuilder,
})
