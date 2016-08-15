// @flow
import Checkbox from './checkbox'
import React from 'react'
import type {DumbComponentMap} from '../constants/types/more'
import {Avatar, Box, Button, ChoiceList, ListItem, StandardScreen, TabBar, Text} from './index'
import {TabBarButton, TabBarItem} from './tab-bar'
import {globalColors} from '../styles/style-guide'

const tabBarButtonMap: DumbComponentMap<TabBarButton> = {
  // $FlowIssue
  component: props => <Box style={{height: 56}}><TabBarButton {...props} /></Box>,
  mocks: {
    'Cog icon': {selected: false, style: {height: 56, width: 72}, source: {type: 'icon', icon: 'iconfont-settings'}, badgeNumber: 7},
  },
}

const tabBarBaseMock = {
  style: {flex: 1},
  children: [
    (<TabBarItem key='one' label='One' selected={true} onClick={() => {}}>
      <Text type='Header' style={{flex: 2}}>One</Text>
    </TabBarItem>),
    (<TabBarItem key='two' label='Two' selected={false} onClick={() => {}}>
      <Text type='Header'>Two</Text>
    </TabBarItem>),
    (<TabBarItem key='three' label='Three' selected={false} onClick={() => {}}>
      <Text type='Header'>Three</Text>
    </TabBarItem>),
  ],
}

const IconButton = ({selected, icon, badgeNumber}: any) => <TabBarButton source={{type: 'icon', icon}} selected={selected} badgeNumber={badgeNumber} />
const AvatarButton = ({selected, avatar, badgeNumber}: any) => <TabBarButton source={{type: 'avatar', avatar}} selected={selected} badgeNumber={badgeNumber} />

const tabBarCustomButtons = selectedIndex => ({
  style: {flex: 1},
  styleTabBar: {justifyContent: 'space-between', height: 56},
  children: [
    {avatar: <Avatar size={32} onClick={null} username='max' />},
    {icon: 'iconfont-people', badgeNumber: 3},
    {icon: 'iconfont-folder'},
    {icon: 'iconfont-device', badgeNumber: 12},
    {icon: 'iconfont-settings'},
  ].map((buttonInfo: any, i) => {
    const button = buttonInfo.avatar
      ? <AvatarButton badgeNumber={buttonInfo.badgeNumber} selected={selectedIndex === i} avatar={buttonInfo.avatar} />
      : <IconButton icon={buttonInfo.icon} badgeNumber={buttonInfo.badgeNumber} selected={selectedIndex === i} />

    return (
      <TabBarItem key={i} tabBarButton={button} style={{flex: 1}} selected={selectedIndex === i} onClick={() => console.log('TabBaritem:onClick')}>
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

const choiceListMap: DumbComponentMap<ChoiceList> = {
  component: ChoiceList,
  mocks: {
    'Two Choices': {
      options: [
        {
          title: 'Host a TXT file',
          description: 'Host a text file on your site, such as yoursite.com/keybase.txt.',
          icon: 'icon-file-txt-48',
          onClick: () => console.log('ChoiceList: onClick TXT file'),
        },
        {
          title: 'Set a DNS',
          description: 'Place a Keybase proof in your DNS records.',
          icon: 'icon-dns-48',
          onClick: () => console.log('ChoiceList: onClick DNS'),
        },
      ],
    },
  },
}

const standardScreenProps = {
  onClose: () => console.log('StandardScreen: onClose'),
  children: <Text type='Header'>Whoa, look at this centered thing</Text>,
}

const standardScreenMap: DumbComponentMap<StandardScreen> = {
  component: StandardScreen,
  mocks: {
    'Normal': {
      ...standardScreenProps,
    },
    'Error w/ Custom Close Text': {
      ...standardScreenProps,
      onCloseText: 'Back',
      notification: {
        message: 'Something went horribly wrong! :-(',
        type: 'error',
      },
    },
    'Success w/ Custom Notification Element': {
      ...standardScreenProps,
      notification: {
        message: <Text type='BodySmallSemibold' style={{color: globalColors.white, textAlign: 'center'}}>You won a unicorn! <Text type='BodySmallPrimaryLink'>Make sure to feed it</Text> :-)</Text>,
        type: 'success',
      },
    },
  },
}

export default {
  'Checkbox': checkboxMap,
  'ChoiceList': choiceListMap,
  'ListItem': listItemMap,
  'StandardScreen': standardScreenMap,
  'TabBar': tabBarMap,
  'TabBarButton': tabBarButtonMap,
}
