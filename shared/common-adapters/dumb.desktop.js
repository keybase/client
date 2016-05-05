// @flow

import React from 'react'

import Checkbox from './checkbox'
import {TabBar, Text, Avatar} from './index'
import {TabBarButton} from './tab-bar'
import {globalStyles, globalColors} from '../styles/style-guide'

import type {DumbComponentMap} from '../constants/types/more'

const onCheck = () => console.log('on check!')

const checkboxMap: DumbComponentMap<Checkbox> = {
  component: Checkbox,
  mocks: {
    'Normal - checked': {
      label: 'Normal - checked',
      onCheck,
      checked: true
    },
    'Normal - unchecked': {
      label: 'Normal - unchecked',
      onCheck,
      checked: false
    },
    'Disabled - checked': {
      label: 'Disabled - checked',
      onCheck,
      disabled: true,
      checked: true
    },
    'Disabled - unchecked': {
      label: 'Disabled - unchecked',
      onCheck,
      disabled: true,
      checked: false
    }
  }
}

const IconButton = ({selected, icon, badgeNumber}: any) => <TabBarButton source={{type: 'icon', icon}} selected={selected} badgeNumber={badgeNumber} style={{height: 40}}/>
const AvatarButton = ({selected, avatar, badgeNumber}: any) => <TabBarButton source={{type: 'avatar', avatar}} selected={selected} badgeNumber={badgeNumber} style={{height: 40}}/>

const tabBarCustomButtons = selectedIndex => ({
  style: {flex: 1, display: 'flex', ...globalStyles.flexBoxRow, height: 580},
  tabBarStyle: {justifyContent: 'flex-start', width: 160, backgroundColor: globalColors.midnightBlue, ...globalStyles.flexBoxColumn},
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
      <TabBar.Item tabBarButton={button} containerStyle={{flex: 0, display: 'flex'}} selected={selectedIndex === i} onPress={() => console.log('TabBar.item:onPress')}>
        <Text type='Header' style={{flex: 2}}>Content here at: {i}</Text>
      </TabBar.Item>
    )
  })
})

const tabBarMap: DumbComponentMap<TabBar> = {
  component: TabBar,
  mocks: {
    'Custom Buttons - 0': tabBarCustomButtons(0),
    'Custom Buttons - 1': tabBarCustomButtons(1)
  }
}

export default {
  'Checkbox': checkboxMap,
  TabBar: tabBarMap
}
