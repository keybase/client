import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Common from '../../router-v2/common.desktop'
import * as Constants from '../../constants/settings'
import * as React from 'react'
import * as Shim from '../../router-v2/shim'
import type AccountTab from '../account/container'
import type AdvancedTab from '../advanced'
import type ChatTab from '../chat/container'
import type DbNukeConfirm from '../db-nuke-confirm/container'
import type DevicesTab from '../../devices/container'
import type DisplayTab from '../display/container'
import type FsTab from '../files/container'
import type GitTab from '../../git/container'
import type InvitationsTab from '../invites/container'
import type InviteSent from '../invite-generated/container'
import type NotificationsTab from '../notifications/container'
import type RemoveDevice from '../../devices/device-revoke/container'
import LeftNav from './left-nav'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'

const settingsSubRoutes = {
  [Constants.devicesTab]: {getScreen: (): typeof DevicesTab => require('../../devices/container').default},
  [Constants.gitTab]: {getScreen: (): typeof GitTab => require('../../git/container').default},
  [Constants.fsTab]: {getScreen: (): typeof FsTab => require('../files/container').default},
  [Constants.advancedTab]: {getScreen: (): typeof AdvancedTab => require('../advanced').default},
  [Constants.chatTab]: {getScreen: (): typeof ChatTab => require('../chat/container').default},
  // TODO connect broken
  [Constants.invitationsTab]: {
    getScreen: (): typeof InvitationsTab => require('../invites/container').default,
  },
  [Constants.accountTab]: {getScreen: (): typeof AccountTab => require('../account/container').default},
  [Constants.displayTab]: {getScreen: (): typeof DisplayTab => require('../display/container').default},
  [Constants.feedbackTab]: {getScreen: (): typeof FeedbackTab => require('../feedback/container').default},
  [Constants.notificationsTab]: {
    getScreen: (): typeof NotificationsTab => require('../notifications/container').default,
  },
  dbNukeConfirm: {getScreen: (): typeof DbNukeConfirm => require('../db-nuke-confirm/container').default},
  inviteSent: {getScreen: (): typeof InviteSent => require('../invite-generated/container').default},
  removeDevice: {
    getScreen: (): typeof RemoveDevice => require('../../devices/device-revoke/container').default,
  },
}

function LeftTabNavigator({initialRouteName, children, screenOptions, backBehavior}) {
  const {state, navigation, descriptors, NavigationContent} = useNavigationBuilder(TabRouter, {
    backBehavior,
    children,
    screenOptions,
    initialRouteName,
  })

  const selectedTab = state.routes[state.index]?.name ?? ''
  const onSelectTab = Common.useSubnavTabAction(navigation, state)

  return (
    <NavigationContent>
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.box}>
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.nav}>
          <LeftNav onClick={onSelectTab} selected={selectedTab} />
        </Kb.Box2>
        <Kb.BoxGrow>
          {state.routes.map((route, i) => {
            return i === state.index ? (
              <Kb.Box2 key={route.key} direction="vertical" fullHeight={true} fullWidth={true}>
                {descriptors[route.key].render()}
              </Kb.Box2>
            ) : null
          })}
        </Kb.BoxGrow>
      </Kb.Box2>
    </NavigationContent>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  box: {backgroundColor: Styles.globalColors.white},
  nav: {width: 180},
}))

const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator)
const TabNavigator = createLeftTabNavigator()

const shimmed = Shim.shim(settingsSubRoutes, false, false)

const SettingsSubNavigator = () => (
  <TabNavigator.Navigator initialRouteName={Constants.accountTab} backBehavior="none">
    {Object.keys(shimmed).map(name => (
      <TabNavigator.Screen
        key={name}
        name={name}
        getComponent={settingsSubRoutes[name].getScreen}
        options={({route, navigation}) => {
          const no = settingsSubRoutes[name].getScreen().navigationOptions
          const opt = typeof no === 'function' ? no({route, navigation}) : no
          return {...opt}
        }}
      />
    ))}
  </TabNavigator.Navigator>
)

SettingsSubNavigator.navigationOptions = {
  title: 'Settings',
}

export default SettingsSubNavigator
