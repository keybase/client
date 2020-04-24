// The stacks we use in the tab view
import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../styles'
import {LeftAction} from '../common-adapters/header-hoc'
import {screens} from './routes'
import {StackNavigationOptions} from '@react-navigation/stack'
import {Stack} from './stack-factory'
import {Tab} from './tab-factory'

const BlankTab = () => null
const PeopleStack = () => (
  <Stack.Navigator initialRouteName="peopleRoot" screenOptions={defaultScreenOptions}>
    {screens}
  </Stack.Navigator>
)
const ChatStack = () => (
  <Stack.Navigator initialRouteName="chatRoot" screenOptions={defaultScreenOptions}>
    {screens}
  </Stack.Navigator>
)
const FSStack = () => (
  <Stack.Navigator initialRouteName="fsRoot" screenOptions={defaultScreenOptions}>
    {screens}
  </Stack.Navigator>
)
const TeamsStack = () => (
  <Stack.Navigator initialRouteName="teamsRoot" screenOptions={defaultScreenOptions}>
    {screens}
  </Stack.Navigator>
)
const SettingsStack = () => (
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

const tabsOptions = ({route}) => {
  return {
    tabBarVisible: route.name !== 'chatConversation',
  }
}

export const tabs = [
  <Tab.Screen key="blankTab" name="blankTab" component={BlankTab} options={tabsOptions} />,
  <Tab.Screen key="tabs.peopleTab" name="tabs.peopleTab" component={PeopleStack} options={tabsOptions} />,
  <Tab.Screen key="tabs.chatTab" name="tabs.chatTab" component={ChatStack} options={tabsOptions} />,
  <Tab.Screen key="tabs.fsTab" name="tabs.fsTab" component={FSStack} options={tabsOptions} />,
  <Tab.Screen key="tabs.teamsTab" name="tabs.teamsTab" component={TeamsStack} options={tabsOptions} />,
  <Tab.Screen
    key="tabs.settingsTab"
    name="tabs.settingsTab"
    component={SettingsStack}
    options={tabsOptions}
  />,
]
