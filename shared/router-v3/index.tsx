import * as React from 'react'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as ConfigGen from '../actions/config-gen'
import * as Shared from './shared'
import logger from '../logger'
import GlobalError from '../app/global-errors/container'
import OutOfDate from '../app/out-of-date'
import RuntimeStats from '../app/runtime-stats/container'
import {NavigationContainer, useNavigation} from '@react-navigation/native'
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import {createStackNavigator} from '@react-navigation/stack'
import {StatusBar, Text} from 'react-native'

// TODO orutes
import {newRoutes as peopleNewRoutes, newModalRoutes as peopleNewModalRoutes} from '../people/routes'
import {newRoutes as chatNewRoutes, newModalRoutes as chatNewModalRoutes} from '../chat/routes'

const ModalStack = createStackNavigator()
const Stack = createStackNavigator()
const Tab = createBottomTabNavigator()

const convertNavigationOptionsToStackOptions = (C: any) => {
  const {navigationOptions} = C

  if (navigationOptions) {
    return {
      header: navigationOptions.header,
      headerTitle: navigationOptions.headerTitle,
      headerTitleContainerStyle: navigationOptions.headerTitleContainerStyle,
    }
  }
  return undefined
}

const TeamBuildingModal = peopleNewModalRoutes.peopleTeamBuilder.getScreen()

const PeopleRoot = peopleNewRoutes.peopleRoot.getScreen()
const PeopleStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="peopleRoot"
        component={PeopleRoot}
        options={convertNavigationOptionsToStackOptions(PeopleRoot)}
      />
    </Stack.Navigator>
  )
}
const TempChat = () => {
  return <Text>temp chat</Text>
}
const ChatStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="chatRoot" component={TempChat /*chatNewRoutes.chatRoot.getScreen()*/} />
    </Stack.Navigator>
  )
}

const ReduxPlumbing = React.memo(({navRef}) => {
  const dispatch = Container.useDispatch()

  const navigator = {
    dispatch: (a: any) => {
      if (!navRef) {
        throw new Error('Missing nav?')
      }
      navRef.dispatch(a)
    },
    dispatchOldAction: (old: any) => {
      if (!navRef) {
        throw new Error('Missing nav?')
      }

      const actions = Shared.oldActionToNewActions(old, navRef) || []
      try {
        actions.forEach(a => navRef.dispatch(a))
      } catch (e) {
        logger.error('Nav error', e)
      }
    },
    getNavState: () => navRef?.state?.nav ?? null,
  }

  // TEMP
  window.NOJIMA = navRef
  // TEMP

  React.useEffect(() => {
    dispatch(ConfigGen.createSetNavigator({navigator}))
  }, [dispatch, navigator])

  return null
})

const Tabs = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen name="tabs.peopleTab" component={PeopleStack} />
      <Tab.Screen name="tabs.chatTab" component={ChatStack} />
    </Tab.Navigator>
  )
}

const RouterV3 = () => {
  const isDarkMode = Styles.isDarkMode()
  const [nav, setNav] = React.useState(null)
  const navIsSet = React.useRef(false)
  return (
    <>
      <StatusBar barStyle={Styles.isAndroid ? 'default' : isDarkMode ? 'light-content' : 'dark-content'} />
      <ReduxPlumbing navRef={nav} />
      <NavigationContainer
        ref={r => {
          if (!navIsSet.current) {
            navIsSet.current = true
            setNav(r)
          }
        }}
      >
        <ModalStack.Navigator mode="modal" screenOptions={{headerShown: false}}>
          <ModalStack.Screen name="Tabs" component={Tabs} />
          <ModalStack.Screen name="peopleTeamBuilder" component={TeamBuildingModal} />
        </ModalStack.Navigator>
      </NavigationContainer>
      <GlobalError />
      <OutOfDate />
      <RuntimeStats />
    </>
  )
}

export default RouterV3
