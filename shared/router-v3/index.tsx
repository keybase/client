import * as React from 'react'
import {NavigationContainer} from '@react-navigation/native'
import {createStackNavigator} from '@react-navigation/stack'
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'

// TODO orutes
import {newRoutes as peopleNewRoutes, newModalRoutes as peopleNewModalRoutes} from '../people/routes'
import {newRoutes as chatNewRoutes, newModalRoutes as chatNewModalRoutes} from '../chat/routes'

const Stack = createStackNavigator()
const Tab = createBottomTabNavigator()

const convertNavigationOptionsToStackOptions = (C: any) => {
  const {navigationOptions} = C

  if (navigationOptions) {
    return {
      header: navigationOptions.header,
      headerTitle: navigationOptions.headerTitle,
      headerTitleContainerStyle: navigationOptions.headerTitleContainerStyle,
      //underNotch: true,
    }
  }
  return undefined
}

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
const ChatStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="chatRoot" component={chatNewRoutes.chatRoot.getScreen()} />
    </Stack.Navigator>
  )
}

const RouterV3 = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="peopleTab" component={PeopleStack} />
        <Tab.Screen name="chatTab" component={ChatStack} />
      </Tab.Navigator>
    </NavigationContainer>
  )
}

export default RouterV3
