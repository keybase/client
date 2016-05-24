// @flow

import React from 'react'

import Checkbox from './checkbox'
import {Button, Box, TabBar, Text, Avatar, ListItem} from './index'
import {TabBarButton, TabBarItem} from './tab-bar'
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

const IconButton = ({selected, icon, badgeNumber}: any) => <TabBarButton source={{type: 'icon', icon}} selected={selected} badgeNumber={badgeNumber} style={{height: 40}} />
const AvatarButton = ({selected, avatar, badgeNumber}: any) => <TabBarButton source={{type: 'avatar', avatar}} selected={selected} badgeNumber={badgeNumber} style={{height: 40}} />

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
      <TabBarItem tabBarButton={button} containerStyle={{flex: 0, display: 'flex'}} selected={selectedIndex === i} onClick={() => console.log('TabBaritem:onClick')}>
        <Text type='Header' style={{flex: 2}}>Content here at: {i}</Text>
      </TabBarItem>
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

const listItemMap: DumbComponentMap<ListItem> = {
  component: ListItem,
  mocks: {
    'Small list item with button action': {
      parentProps: {style: {border: 'solid 1px black'}},
      type: 'Small',
      icon: <Box style={{height: 32, width: 32, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Button label={'Action'} type={'Primary'} onClick={() => {}} />
    },
    'Small list item with text action': {
      parentProps: {style: {border: 'solid 1px black'}},
      type: 'Small',
      icon: <Box style={{height: 32, width: 32, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Text style={{color: globalColors.red}} type={'BodySmall'} onClick={() => {}}>Action Jack</Text>,
      extraRightMarginAction: true
    },
    'Large list item with Button': {
      parentProps: {style: {border: 'solid 1px black'}},
      type: 'Large',
      icon: <Box style={{height: 48, width: 48, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Button label={'Action'} type={'Primary'} onClick={() => {}} />
    },
    'Large list item with text action': {
      parentProps: {style: {border: 'solid 1px black'}},
      type: 'Large',
      icon: <Box style={{height: 48, width: 48, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Text style={{color: globalColors.red}} type={'BodySmall'} onClick={() => {}}>Action Jack</Text>,
      extraRightMarginAction: true
    }
  }
}

export default {
  'Checkbox': checkboxMap,
  TabBar: tabBarMap,
  ListItem: listItemMap
}
