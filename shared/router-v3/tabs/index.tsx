// The main navigation tabs
import * as React from 'react'
import * as Styles from '../../styles'
import {tabs} from '../tab-stacks'
import {Tab} from '../tab-factory'
import MobileTabBar from './mobile-tab-bar'

const Tabs = () => {
  console.log('aaa tab render')
  return (
    <Tab.Navigator
      initialRouteName={Styles.isMobile ? 'blankTab' : 'tabs.peopleTab'}
      backBehavior="none"
      tabbar={Styles.isMobile ? MobileTabBar : undefined}
      screenOptions={{keyboardHidesTabBar: Styles.isAndroid}}
    >
      {tabs}
    </Tab.Navigator>
  )
}

export default Tabs
