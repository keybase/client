// @flow
import React, {Component} from 'react'
import _ from 'lodash'
import type {DumbComponentMap} from '../constants/types/more'
import type {IconType} from './icon.constants'
import {Avatar, Button, Box, Checkbox, ChoiceList, Icon, Input, SmallInput, ListItem, PopupMenu, StandardScreen, TabBar, Text} from './index'
import {TabBarButton, TabBarItem} from './tab-bar'
import {globalStyles, globalColors} from '../styles'
import {iconMeta} from './icon.constants'

const onCheck = () => console.log('on check!')

const checkboxMap: DumbComponentMap<Checkbox> = {
  component: Checkbox,
  mocks: {
    'Normal - checked': {
      label: 'Normal - checked',
      onCheck,
      checked: true,
    },
    'Normal - unchecked': {
      label: 'Normal - unchecked',
      onCheck,
      checked: false,
    },
    'Disabled - checked': {
      label: 'Disabled - checked',
      onCheck,
      disabled: true,
      checked: true,
    },
    'Disabled - unchecked': {
      label: 'Disabled - unchecked',
      onCheck,
      disabled: true,
      checked: false,
    },
  },
}

class IconHolder extends Component<void, {iconFont: boolean}, void> {
  render () {
    // $FlowIssue
    const keys: Array<IconType> = Object.keys(iconMeta)
    const icons: Array<IconType> = keys.filter(name => iconMeta[name].isFont === this.props.iconFont)
    return (
      <Box style={{...globalStyles.flexBoxRow, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'flex-start'}}>
      {icons.map(i => <Box key={i}><Text type='BodyXSmall'>{i}</Text><Icon type={i} style={{margin: 10, border: 'solid 1px #777777'}} /></Box>)}
      </Box>
    )
  }
}

const iconMap: DumbComponentMap<IconHolder> = {
  component: IconHolder,
  mocks: {
    'Icon IconFont': {
      label: 'Sheet',
      iconFont: true,
    },
    'Icon Image': {
      label: 'Sheet',
      iconFont: false,
    },
  },
}

const inputMap: DumbComponentMap<Input> = {
  component: Input,
  mocks: {
    'Default Empty': {},
    'Default Filled': {
      value: 'Hello, World!',
    },
    'Hint Empty': {
      hintText: 'Hello...',
    },
    'Floating Label Empty': {
      floatingLabelText: 'Hello...',
    },
    'Floating Label Filled': {
      floatingLabelText: 'Hello...',
      value: 'Hello, World!',
    },
    'Floating Label Error': {
      floatingLabelText: 'Hello...',
      value: 'Hello, Worl',
      errorText: 'Check your spelling',
    },
    'Floating Label Hint Empty': {
      hintText: 'Hello!',
      floatingLabelText: 'Hello...',
    },
    'Hint Multiline Empty': {
      hintText: 'This is a very long hint that will hopefully wrap to two lines',
      multiline: true,
    },
    'Floating Label Multiline Empty': {
      floatingLabelText: 'Hello...',
      multiline: true,
    },
    'Floating Label Multiline Filled': {
      floatingLabelText: 'Hello...',
      multiline: true,
      value: 'Hello, World!',
    },
    'Floating Label Multiline Filled Long': {
      floatingLabelText: 'Hello...',
      multiline: true,
      value: 'Hello,\nMy name is Max\nHow are you?',
    },
    'Small Empty': {
      small: true,
    },
    'Small Filled': {
      small: true,
      value: 'Hello, World!',
    },
    'Small Hint Empty': {
      small: true,
      hintText: 'Hello...',
    },
  },
}

const smallInputMap: DumbComponentMap<SmallInput> = {
  component: SmallInput,
  mocks: {
    'Default Empty': {
      label: 'Greet:',
      hintText: 'Hello...',
      value: null,
    },
    'Default Filled': {
      label: 'Greet:',
      hintText: 'Hello...',
      value: 'Hello, World!',
    },
    'Error Empty': {
      label: 'Greet:',
      hintText: 'Hello...',
      errorState: true,
      value: null,
    },
    'Error Filled': {
      label: 'Greet:',
      hintText: 'Hello...',
      value: 'Hello, World!',
      errorState: true,
    },
  },
}

const tabBarCustomButtons = selectedIndex => {
  const IconButton = ({selected, icon, badgeNumber, label}: any) => <TabBarButton label={label} source={{type: 'icon', icon}} selected={selected} badgeNumber={badgeNumber} style={{height: 40}} />
  const AvatarButton = ({selected, avatar, badgeNumber}: any) => <TabBarButton source={{type: 'avatar', avatar}} selected={selected} badgeNumber={badgeNumber} style={{flex: 1}} styleContainer={{height: 40}} />

  return {
    style: {flex: 1, display: 'flex', ...globalStyles.flexBoxRow, height: 580},
    styleTabBar: {justifyContent: 'flex-start', width: 160, backgroundColor: globalColors.midnightBlue, ...globalStyles.flexBoxColumn},
    children: [
      {avatar: <Avatar size={32} onClick={null} username='max' />},
      {icon: 'iconfont-people', label: 'PEOPLE', badgeNumber: 3},
      {icon: 'iconfont-folder', label: 'FOLDERS'},
      {icon: 'iconfont-device', label: 'DEVICES', badgeNumber: 12},
      {icon: 'iconfont-settings', label: 'SETTINGS'},
    ].map((buttonInfo: any, i) => {
      const button = buttonInfo.avatar
        ? <AvatarButton badgeNumber={buttonInfo.badgeNumber} selected={selectedIndex === i} avatar={buttonInfo.avatar} />
        : <IconButton icon={buttonInfo.icon} label={buttonInfo.label} badgeNumber={buttonInfo.badgeNumber} selected={selectedIndex === i} />
      return (
        <TabBarItem key={i} tabBarButton={button} styleContainer={{display: 'flex'}} selected={selectedIndex === i} onClick={() => console.log('TabBaritem:onClick')}>
          <Text type='Header' style={{flex: 1}}>Content here at: {i}</Text>
        </TabBarItem>
      )
    }),
  }
}

const tabBarMap: DumbComponentMap<TabBar> = {
  component: TabBar,
  mocks: {
    'Custom Buttons - 0': tabBarCustomButtons(0),
    'Custom Buttons - 1': tabBarCustomButtons(1),
  },
}

const listItemMap: DumbComponentMap<ListItem> = {
  component: ListItem,
  mocks: {
    'Small list item with button action': {
      parentProps: {style: {border: 'solid 1px black'}},
      type: 'Small',
      icon: <Box style={{height: 32, width: 32, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Button label={'Action'} type={'Primary'} onClick={() => {}} />,
    },
    'Small list item with text action': {
      parentProps: {style: {border: 'solid 1px black'}},
      type: 'Small',
      icon: <Box style={{height: 32, width: 32, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Text style={{color: globalColors.red}} type={'BodySmall'} onClick={() => {}}>Action Jack</Text>,
      extraRightMarginAction: true,
    },
    'Large list item with Button': {
      parentProps: {style: {border: 'solid 1px black'}},
      type: 'Large',
      icon: <Box style={{height: 48, width: 48, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Button label={'Action'} type={'Primary'} onClick={() => {}} />,
    },
    'Large list item with text action': {
      parentProps: {style: {border: 'solid 1px black'}},
      type: 'Large',
      icon: <Box style={{height: 48, width: 48, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Text style={{color: globalColors.red}} type={'BodySmall'} onClick={() => {}}>Action Jack</Text>,
      extraRightMarginAction: true,
    },
  },
}

const popupCommon = {
  parentProps: {style: {border: 'solid 1px black', position: 'relative', height: 300}},
  onHidden: () => console.log('popup hidden'),
  style: {marginLeft: 100, maxWidth: 320},
}

const popupItemCommon = {
  onClick: () => console.log('item clicked'),
}

const popupMenuMap: DumbComponentMap<PopupMenu> = {
  component: PopupMenu,
  mocks: {
    'Popup Simple': {
      ...popupCommon,
      items: [
        {...popupItemCommon, title: 'One'},
        {...popupItemCommon, title: 'Two'},
        {...popupItemCommon, title: 'Three'},
      ],
    },
    'Popup Complex': {
      ...popupCommon,
      items: [
        {...popupItemCommon, title: 'Open in Finder'},
        {...popupItemCommon, title: 'Ignore'},
        'Divider',
        {...popupItemCommon, title: 'Clear history (3.24 MB)', subTitle: 'Deletes old copies of files.', danger: true},
        {...popupItemCommon, title: 'Delete files and clear history (5.17GB)', subTitle: 'Deletes everything in this folder, including its backup versions', danger: true},
      ],
    },
  },
}

const mockAvatarSizes = (title, sizes, modifiers) => _.chain(sizes)
  .map(size => ({size, username: 'awendland', ...modifiers}))
  .keyBy(props => `${title} x${props.size}`)
  .value()

const avatarMap: DumbComponentMap<Avatar> = {
  component: Avatar,
  mocks: {
    ...mockAvatarSizes('Normal', [32], {}),
    ...mockAvatarSizes('Following', [48], {
      following: true,
    }),
    ...mockAvatarSizes('Follows You', [64], {
      followsYou: true,
    }),
    ...mockAvatarSizes('Mutual Follow', [112], {
      following: true,
      followsYou: true,
    }),
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
    'Error': {
      ...standardScreenProps,
      notification: {
        message: 'Something went horribly wrong! :-(',
        type: 'error',
      },
    },
    'Success w/ Custom Notification Element': {
      ...standardScreenProps,
      notification: {
        message: <Text type='BodySmallSemibold' style={{color: globalColors.white}}>You won a unicorn! <Text type='BodySmallSemibold' style={{color: globalColors.white, textDecoration: 'underline'}}>Make sure to feed it</Text> :-)</Text>,
        type: 'success',
      },
    },
  },
}

export default {
  Avatar: avatarMap,
  Checkbox: checkboxMap,
  ChoiceList: choiceListMap,
  Icon: iconMap,
  Input: inputMap,
  SmallInput: smallInputMap,
  ListItem: listItemMap,
  PopupMenu: popupMenuMap,
  StandardScreen: standardScreenMap,
  TabBar: tabBarMap,
}
