// @flow

import React from 'react'

import Checkbox from './checkbox'
import {TabBar, Text, Box} from './index'
import {TabBarButton} from './tab-bar'

import {Avatar} from './index'

import type {DumbComponentMap} from '../constants/types/more'

const tabBarButtonMap: DumbComponentMap<TabBarButton> = {
  // $FlowIssue
  component: props => <Box style={{height: 56}}><TabBarButton {...props} /></Box>,
  mocks: {
    'Cog icon': {selected: false, style: {height: 56, width: 72}, source: {type: 'icon', icon: 'fa-cog'}, badgeNumber: 7}
  }
}

const tabBarBaseMock = {
  style: {flex: 1},
  children: [
    (<TabBar.Item label='One' selected onPress={() => {}}>
      <Text type='Header' style={{flex: 2}}>One</Text>
    </TabBar.Item>),
    (<TabBar.Item label='Two' selected={false} onPress={() => {}}>
      <Text type='Header'>Two</Text>
    </TabBar.Item>),
    (<TabBar.Item label='Three' selected={false} onPress={() => {}}>
      <Text type='Header'>Three</Text>
    </TabBar.Item>)
  ]
}

const IconButton = ({selected, icon, badgeNumber}: any) => <TabBarButton source={{type: 'icon', icon}} selected={selected} badgeNumber={badgeNumber} />
const AvatarButton = ({selected, avatar, badgeNumber}: any) => <TabBarButton source={{type: 'avatar', avatar}} selected={selected} badgeNumber={badgeNumber} />

const tabBarCustomButtons = selectedIndex => ({
  style: {flex: 1},
  tabBarStyle: {justifyContent: 'space-between', height: 56},
  children: [
    {avatar: <Avatar size={32} onClick={null} username='max' />},
    {icon: 'fa-users', badgeNumber: 3},
    {icon: 'fa-folder'},
    {icon: 'phone-bw-m', badgeNumber: 12},
    {icon: 'fa-cog'}
  ].map((buttonInfo: any, i) => {
    const button = buttonInfo.avatar ? <AvatarButton badgeNumber={buttonInfo.badgeNumber} selected={selectedIndex === i} avatar={buttonInfo.avatar} />
      : <IconButton icon={buttonInfo.icon} badgeNumber={buttonInfo.badgeNumber} selected={selectedIndex === i} />

    return (
      <TabBar.Item tabBarButton={button} containerStyle={{flex: 1}} selected={selectedIndex === i} onPress={() => console.log('TabBar.item:onPress')}>
        <Text type='Header' style={{flex: 2}}>Content here at: {i}</Text>
      </TabBar.Item>
    )
  })
})

const tabBarMap: DumbComponentMap<TabBar> = {
  component: TabBar,
  mocks: {
    'Custom Buttons - 0': tabBarCustomButtons(0),
    'Custom Buttons - 1': tabBarCustomButtons(1),
    'Custom Buttons - 2': tabBarCustomButtons(2),
    'Custom Buttons - 3 - bottom': {...tabBarCustomButtons(2), tabBarOnBottom: true},
    'Normal': tabBarBaseMock,
    'Bottom': {...tabBarBaseMock, tabBarOnBottom: true}
  }
}

const onCheck = () => console.log('checkbox:onCheck')

const checkboxMap: DumbComponentMap<Checkbox> = {
  component: Checkbox,
  mocks: {
    'Normal - checked': {
      label: 'Normal - checked',
      checked: true,
      onCheck
    },
    'Normal - unchecked': {
      label: 'Normal - unchecked',
      checked: false,
      onCheck
    },
    'Disabled - checked': {
      label: 'Disabled - checked',
      disabled: true,
      checked: true,
      onCheck
    },
    'Disabled - unchecked': {
      label: 'Disabled - unchecked',
      disabled: true,
      checked: false,
      onCheck
    }
  }
}

export default {
  'TabBarButton': tabBarButtonMap,
  'TabBar': tabBarMap,
  'Checkbox': checkboxMap
}
