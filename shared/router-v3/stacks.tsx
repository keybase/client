// The stacks we use in the tab view
import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../styles'
import {LeftAction} from '../common-adapters/header-hoc'
import {screens} from './routes'
import {StackNavigationOptions} from '@react-navigation/stack'
import {Stack} from './stack'

export const BlankTab = () => null
export const PeopleStack = () => (
  <Stack.Navigator initialRouteName="peopleRoot" screenOptions={defaultScreenOptions}>
    {screens}
  </Stack.Navigator>
)
export const ChatStack = () => (
  <Stack.Navigator initialRouteName="chatRoot" screenOptions={defaultScreenOptions}>
    {screens}
  </Stack.Navigator>
)
export const FSStack = () => (
  <Stack.Navigator initialRouteName="fsRoot" screenOptions={defaultScreenOptions}>
    {screens}
  </Stack.Navigator>
)
export const TeamsStack = () => (
  <Stack.Navigator initialRouteName="teamsRoot" screenOptions={defaultScreenOptions}>
    {screens}
  </Stack.Navigator>
)
export const SettingsStack = () => (
  <Stack.Navigator initialRouteName="settingsRoot" screenOptions={defaultScreenOptions}>
    {screens}
  </Stack.Navigator>
)

const defaultScreenOptions: StackNavigationOptions = {
  cardStyle: {
    backgroundColor: Styles.globalColors.white,
  },
  headerLeft: ({canGoBack, onPress, tintColor}) =>
    canGoBack ? (
      <LeftAction
        badgeNumber={0}
        leftAction="back"
        onLeftAction={onPress} // react navigation makes sure this onPress can only happen once
        customIconColor={tintColor}
      />
    ) : null,
  headerRight: undefined,
  headerStyle: {
    get backgroundColor() {
      return Styles.globalColors.fastBlank
    },
    get borderBottomColor() {
      return Styles.globalColors.black_10
    },
    borderBottomWidth: 1,
    borderStyle: 'solid',
    elevation: undefined, // since we use screen on android turn off drop shadow
  },
  headerTitle: ({children}) => (
    <Kb.Text type="BodyBig" style={styles.headerTitle} lineClamp={1}>
      {children}
    </Kb.Text>
  ),
}

const styles = Styles.styleSheetCreate(() => ({
  headerTitle: {color: Styles.globalColors.black},
}))

export const tabStacks = [
  {component: BlankTab, name: 'blankTab'},
  {component: PeopleStack, name: 'tabs.peopleTab'},
  {component: ChatStack, name: 'tabs.chatTab'},
  {component: FSStack, name: 'tabs.fsTab'},
  {component: TeamsStack, name: 'tabs.teamsTab'},
  {component: SettingsStack, name: 'tabs.settingsTab'},
]
