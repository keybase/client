// The stacks we use in the tab view
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'
import {LeftAction} from '../common-adapters/header-hoc'
import {screens} from './routes'
import {StackNavigationOptions} from '@react-navigation/stack'
import {Stack} from './stack-factory'
import {Tab} from './tab-factory'
import {KeyboardAvoidingView} from 'react-native'

const BlankTab = () => null

const makeStack = (initialRouteName: string) => () => (
  <KeyboardAvoidingView behavior={Styles.isIOS ? 'padding' : undefined} style={styles.keyboardAvoiding}>
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={defaultScreenOptions}>
      {screens}
    </Stack.Navigator>
  </KeyboardAvoidingView>
)

const PeopleStack = makeStack('peopleRoot')
const ChatStack = makeStack('chatRoot')
const FSStack = makeStack('fsRoot')
const CryptoStack = makeStack('cryptoRoot')
const TeamsStack = makeStack('teamsRoot')
const WalletsStack = makeStack('walletsRoot')
const GitStack = makeStack('gitRoot')
const DevicesStack = makeStack('devicesRoot')
const SettingsStack = makeStack('settingsRoot')

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
      return Styles.globalColors.white
    },
    get borderBottomColor() {
      return Styles.globalColors.black_10
    },
    borderBottomWidth: 1,
    borderStyle: 'solid',
    elevation: undefined, // since we use screen on android turn off drop shadow
    height: 64, // MUST be height else the card won't figure out the size
  },
  headerTitle: ({children}) => (
    <Kb.Text type="BodyBig" style={styles.headerTitle} lineClamp={1}>
      {children}
    </Kb.Text>
  ),
}

const styles = Styles.styleSheetCreate(() => ({
  headerTitle: {color: Styles.globalColors.black},
  keyboardAvoiding: {height: '100%', width: '100%'},
}))

const tabsOptions = ({route}) => {
  const routeName = route.state ? route.state.routes[route.state.index].name : route.params?.screen

  return {
    tabBarVisible: routeName !== 'chatConversation',
  }
}

export const tabs = [
  <Tab.Screen key="blankTab" name="blankTab" component={BlankTab} options={tabsOptions} />,
  <Tab.Screen key="tabs.peopleTab" name="tabs.peopleTab" component={PeopleStack} options={tabsOptions} />,
  <Tab.Screen key="tabs.chatTab" name="tabs.chatTab" component={ChatStack} options={tabsOptions} />,
  <Tab.Screen key="tabs.fsTab" name="tabs.fsTab" component={FSStack} options={tabsOptions} />,
  ...(Styles.isMobile
    ? []
    : [
        <Tab.Screen
          key="tabs.cryptoTab"
          name="tabs.cryptoTab"
          component={CryptoStack}
          options={tabsOptions}
        />,
      ]),
  <Tab.Screen key="tabs.teamsTab" name="tabs.teamsTab" component={TeamsStack} options={tabsOptions} />,
  ...(Styles.isMobile
    ? []
    : [
        <Tab.Screen
          key="tabs.walletsTab"
          name="tabs.walletsTab"
          component={WalletsStack}
          options={tabsOptions}
        />,
      ]),
  ...(Styles.isMobile
    ? []
    : [<Tab.Screen key="tabs.gitTab" name="tabs.gitTab" component={GitStack} options={tabsOptions} />]),
  ...(Styles.isMobile
    ? []
    : [
        <Tab.Screen
          key="tabs.devicesTab"
          name="tabs.devicesTab"
          component={DevicesStack}
          options={tabsOptions}
        />,
      ]),
  <Tab.Screen
    key="tabs.settingsTab"
    name="tabs.settingsTab"
    component={SettingsStack}
    options={tabsOptions}
  />,
]
