// @flow

import React from 'react'

import Checkbox from './checkbox'
import {TabBar, Text, Box, ListItem, Button} from './index'
import {TabBarButton, TabBarItem} from './tab-bar'
import {globalColors} from '../styles/style-guide'

import {Avatar} from './index'

import type {DumbComponentMap} from '../constants/types/more'

const tabBarButtonMap: DumbComponentMap<TabBarButton> = {
  // $FlowIssue
  component: props => <Box style={{height: 56}}><TabBarButton {...props} /></Box>,
  mocks: {
    'Cog icon': {selected: false, style: {height: 56, width: 72}, source: {type: 'icon', icon: 'fa-cog'}, badgeNumber: 7},
  },
}

const tabBarBaseMock = {
  style: {flex: 1},
  children: [
    (<TabBarItem label='One' selected onClick={() => {}}>
      <Text type='Header' style={{flex: 2}}>One</Text>
    </TabBarItem>),
    (<TabBarItem label='Two' selected={false} onClick={() => {}}>
      <Text type='Header'>Two</Text>
    </TabBarItem>),
    (<TabBarItem label='Three' selected={false} onClick={() => {}}>
      <Text type='Header'>Three</Text>
    </TabBarItem>),
  ],
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
    {icon: 'fa-cog'},
  ].map((buttonInfo: any, i) => {
    const button = buttonInfo.avatar ? <AvatarButton badgeNumber={buttonInfo.badgeNumber} selected={selectedIndex === i} avatar={buttonInfo.avatar} />
      : <IconButton icon={buttonInfo.icon} badgeNumber={buttonInfo.badgeNumber} selected={selectedIndex === i} />

    return (
      <TabBarItem tabBarButton={button} styleContainer={{flex: 1}} selected={selectedIndex === i} onClick={() => console.log('TabBaritem:onClick')}>
        <Text type='Header' style={{flex: 2}}>Content here at: {i}</Text>
      </TabBarItem>
    )
  }),
})

const tabBarMap: DumbComponentMap<TabBar> = {
  component: TabBar,
  mocks: {
    'Custom Buttons - 0': tabBarCustomButtons(0),
    'Custom Buttons - 1': tabBarCustomButtons(1),
    'Custom Buttons - 2': tabBarCustomButtons(2),
    'Custom Buttons - 3 - bottom': {...tabBarCustomButtons(2), tabBarOnBottom: true},
    'Normal': tabBarBaseMock,
    'Bottom': {...tabBarBaseMock, tabBarOnBottom: true},
  },
}

const onCheck = () => console.log('checkbox:onCheck')

const checkboxMap: DumbComponentMap<Checkbox> = {
  component: Checkbox,
  mocks: {
    'Normal - checked': {
      label: 'Normal - checked',
      checked: true,
      onCheck,
    },
    'Normal - unchecked': {
      label: 'Normal - unchecked',
      checked: false,
      onCheck,
    },
    'Disabled - checked': {
      label: 'Disabled - checked',
      disabled: true,
      checked: true,
      onCheck,
    },
    'Disabled - unchecked': {
      label: 'Disabled - unchecked',
      disabled: true,
      checked: false,
      onCheck,
    },
  },
}

const listItemMap: DumbComponentMap<ListItem> = {
  component: ListItem,
  mocks: {
    'Small list item with button action': {
      parentProps: {style: {borderColor: 'black', borderWidth: 1}},
      type: 'Small',
      icon: <Box style={{height: 32, width: 32, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Button label={'Action'} type={'Primary'} onClick={() => {}} />,
    },
    'Small list item with swipe action': {
      parentProps: {style: {borderColor: 'black', borderWidth: 1}},
      type: 'Small',
      icon: <Box style={{height: 32, width: 32, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Text style={{color: globalColors.red}} type={'BodySmall'} onClick={() => {}}>Action Jack</Text>,
      swipeToAction: true,
    },
    'Large list item with Button': {
      parentProps: {style: {borderColor: 'black', borderWidth: 1}},
      type: 'Large',
      icon: <Box style={{height: 48, width: 48, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Button label={'Action'} type={'Primary'} onClick={() => {}} />,
    },
    'Large list item with swipe action': {
      parentProps: {style: {borderColor: 'black', borderWidth: 1}},
      type: 'Large',
      icon: <Box style={{height: 48, width: 48, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Text style={{color: globalColors.red}} type={'BodySmall'} onClick={() => {}}>Action Jack</Text>,
      swipeToAction: true,
    },
  },
}

export default {
  'TabBarButton': tabBarButtonMap,
  'TabBar': tabBarMap,
  'Checkbox': checkboxMap,
  ListItem: listItemMap,
}
