// The main navigation tabs
import * as React from 'react'
import * as Styles from '../styles'
import {tabs} from './tab-stacks'
import {Tab} from './tab-factory'

const NavTabs = () => {
  console.log('aaa tab render')
  return (
    <Tab.Navigator
      initialRouteName="tabs.peopleTab"
      backBehavior="none"
      screenOptions={{keyboardHidesTabBar: Styles.isAndroid}}
    >
      {tabs}
    </Tab.Navigator>
  )
}

export default NavTabs
