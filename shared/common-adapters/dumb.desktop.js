// @flow
import React, {Component} from 'react'
import _ from 'lodash'
import type {DumbComponentMap} from '../constants/types/more'
import type {IconType} from './icon.constants'
import {Avatar, Button, Box, Checkbox, ChoiceList, Icon, Input, SmallInput, ListItem, PopupMenu, StandardScreen, TabBar, Text, Terminal, Dropdown} from './index'
import {TabBarButton, TabBarItem} from './tab-bar'
import {globalStyles, globalColors} from '../styles'
import {iconMeta} from './icon.constants'

const onCheck = () => console.log('on check!')
const onClick = () => console.log('on click!')

const dropdownMap: DumbComponentMap<Dropdown> = {
  component: Dropdown,
  mocks: {
    'Normal': {
      type: 'General',
      options: ['one', 'two', 'three'],
      value: 'one',
      onOther: onClick,
      onClick: onClick,
    },
    'Not selected': {
      type: 'General',
      options: ['one', 'two', 'three'],
      onOther: onClick,
      onClick: onClick,
    },
    'Username': {
      type: 'Username',
      options: ['marcopolo', 'chris', 'cjb', 'bbbbbbbbbbbbbbbb'],
      value: 'cjb',
      onOther: onClick,
      onClick: onClick,
    },
  },
}
const colorMocks = {}

Object.keys(globalColors).sort().forEach(c => {
  colorMocks[`${c}: ${globalColors[c]}`] = {
    parentProps: {
      height: 60,
      width: 230,
    },
    style: {width: 60, height: 60, backgroundColor: globalColors[c]},
    children: <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', marginLeft: 5}} />,
  }
})

const colorsMap: DumbComponentMap<Box> = {
  component: Box,
  mocks: colorMocks,
}

let textMocks = {}
const backgroundModes = ['Normal', 'Terminal', 'Announcements', 'Success', 'Information', 'HighRisk', 'Documentation']

backgroundModes.forEach(backgroundMode => {
  const backgroundColor = {
    'Normal': globalColors.white,
    'Terminal': globalColors.darkBlue3,
    'Announcements': globalColors.blue,
    'Success': globalColors.green,
    'Information': globalColors.yellow,
    'HighRisk': globalColors.red,
    'Documentation': globalColors.darkBlue,
  }[backgroundMode]

  const base = {
    parentProps: {
      style: {
        backgroundColor,
        padding: 10,
        minWidth: 320,
      },
    },
    backgroundMode,
  }

  const mocks = {}

  const types = [
    'Body',
    'BodyPrimaryLink',
    'BodySemibold',
    'BodySmall',
    'BodySmallError',
    'BodySmallLink',
    'BodySmallPrimaryLink',
    'BodySmallSecondaryLink',
    'BodySmallSemibold',
    'BodyXSmall',
    'BodyXSmallLink',
    'Header',
    'HeaderBig',
    'HeaderError',
    'HeaderJumbo',
    'HeaderLink',
  ]

  types.forEach(type => {
    mocks[type] = {
      ...base,
      type,
      children: type,
    }
  })

  Object.keys(mocks).forEach(key => {
    textMocks[`${key}: ${backgroundMode}`] = mocks[key]
  })
})

const textMap: DumbComponentMap<Text> = {
  component: Text,
  mocks: textMocks,
}

const terminalMap: DumbComponentMap<Box> = {
  component: Box,
  mocks: {
    'Terminal': {
      children: [
        <Box key='a' style={{...globalStyles.flexBoxColumn, flex: 1, padding: 10}}>
          <p>
            <Text type='BodySmall'>Word word </Text>
            <Text type='Terminal'>inline command line </Text>
            <Text type='TerminalUsername'>username </Text>
            <Text type='TerminalPrivate'>'secret'</Text>
            <Text type='BodySmall'> word word word word word </Text>
            <Text type='Terminal'>inline command line</Text>
          </p>
        </Box>,
        <Terminal key='b' style={{flex: 1, overflow: 'scroll'}}>
          <p>
            <Text type='Terminal'>command line stuff </Text>
            <Text type='TerminalUsername'>username </Text>
            <Text type='TerminalPrivate'>'something secret'</Text>
          </p>

          <p>
            <Text type='Terminal'>command line stuff </Text>
            <Text type='TerminalUsername'>username </Text>
            <Text type='TerminalPublic'>'something public'</Text>
          </p>

          <Text type='TerminalComment'>comment</Text>
          <Text type='TerminalComment'>comment</Text>
        </Terminal>,
      ],
    },
  },
}

const commonButton = {
  onClick,
}

const buttonsMap: DumbComponentMap<Button> = {
  component: Button,
  mocks: {
    'Primary': {
      ...commonButton,
      label: 'Primary',
      type: 'Primary',
    },
    'Primary disabled': {
      ...commonButton,
      label: 'Primary',
      type: 'Primary',
      disabled: true,
    },
    'Primary waiting': {
      ...commonButton,
      label: 'Primary',
      type: 'Primary',
      waiting: true,
    },
    'Secondary': {
      ...commonButton,
      label: 'Secondary',
      type: 'Secondary',
    },
    'Secondary disabled': {
      ...commonButton,
      label: 'Secondary',
      type: 'Secondary',
      disabled: true,
    },
    'Secondary waiting': {
      ...commonButton,
      label: 'Secondary',
      type: 'Secondary',
      waiting: true,
    },
    'Danger': {
      ...commonButton,
      label: 'Danger',
      type: 'Danger',
    },
    'Danger disabled': {
      ...commonButton,
      label: 'Danger',
      type: 'Danger',
      disabled: true,
    },
    'Danger waiting': {
      ...commonButton,
      label: 'Danger',
      type: 'Danger',
      waiting: true,
    },
    'Follow': {
      ...commonButton,
      label: 'Follow',
      type: 'Follow',
    },
    'Follow Disabled': {
      ...commonButton,
      label: 'Follow',
      type: 'Follow',
      disabled: true,
    },
    'Following': {
      ...commonButton,
      label: 'Following',
      type: 'Following',
    },
    'Unfollow': {
      ...commonButton,
      label: 'Unfollow',
      type: 'Unfollow',
    },
    'Primary fullWidth': {
      ...commonButton,
      label: 'Primary',
      type: 'Primary',
      fullWidth: true,
    },
    'Primary fullWidth waiting': {
      ...commonButton,
      label: 'Primary',
      type: 'Primary',
      fullWidth: true,
      waiting: true,
    },
    'Secondary fullWidth': {
      ...commonButton,
      label: 'Secondary',
      type: 'Secondary',
      fullWidth: true,
    },
    'Secondary fullWidth waiting': {
      ...commonButton,
      label: 'Secondary',
      type: 'Secondary',
      fullWidth: true,
      waiting: true,
    },
    'Danger fullWidth': {
      ...commonButton,
      label: 'Danger',
      type: 'Danger',
      fullWidth: true,
    },
    'Danger fullWidth waiting': {
      ...commonButton,
      label: 'Danger',
      type: 'Danger',
      fullWidth: true,
      waiting: true,
    },
    'Follow fullWidth': {
      ...commonButton,
      label: 'Follow',
      type: 'Follow',
      fullWidth: true,
    },
    'Follow fullWidth waiting': {
      ...commonButton,
      label: 'Follow',
      type: 'Follow',
      fullWidth: true,
      waiting: true,
    },
    'Primary small': {
      ...commonButton,
      label: 'Primary',
      type: 'Primary',
      small: true,
    },
    'Secondary small': {
      ...commonButton,
      label: 'Primary',
      type: 'Primary',
      small: true,
    },
    'Danger small': {
      ...commonButton,
      label: 'Primary',
      type: 'Primary',
      small: true,
    },
    'Follow small': {
      ...commonButton,
      label: 'Primary',
      type: 'Primary',
      small: true,
    },
    'Primary small waiting': {
      ...commonButton,
      label: 'Primary',
      type: 'Primary',
      small: true,
      waiting: true,
    },
    'Secondary small waiting': {
      ...commonButton,
      label: 'Primary',
      type: 'Primary',
      small: true,
      waiting: true,
    },
    'Danger small waiting': {
      ...commonButton,
      label: 'Primary',
      type: 'Primary',
      small: true,
      waiting: true,
    },
    'Follow small waiting': {
      ...commonButton,
      label: 'Primary',
      type: 'Primary',
      small: true,
      waiting: true,
    },
    'Secondary terminal': {
      ...commonButton,
      label: 'Secondary',
      type: 'Secondary',
      backgroundMode: 'Terminal',
    },
    'Secondary terminal fullWidth': {
      ...commonButton,
      label: 'Secondary',
      type: 'Secondary',
      backgroundMode: 'Terminal',
      fullWidth: true,
    },
  },
}

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
      onChange: ev => console.log('onChange', ev),
    },
    'Default Filled': {
      label: 'Greet:',
      hintText: 'Hello...',
      value: 'Hello, World!',
      onChange: ev => console.log('onChange', ev),
    },
    'Error Empty': {
      label: 'Greet:',
      hintText: 'Hello...',
      errorState: true,
      value: null,
      onChange: ev => console.log('onChange', ev),
    },
    'Error Filled': {
      label: 'Greet:',
      hintText: 'Hello...',
      value: 'Hello, World!',
      errorState: true,
      onChange: ev => console.log('onChange', ev),
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
  parentProps: {style: {display: 'flex', height: 578}},
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
    'Back Button': {
      ...standardScreenProps,
      onClose: null,
      onBack: () => console.log('StandardScreen: onBack'),
    },
    'Error w/ Back Button': {
      ...standardScreenProps,
      onClose: null,
      onBack: () => console.log('StandardScreen: onBack'),
      notification: {
        message: 'This is an error, but you can go back!',
        type: 'error',
      },
    },
  },
}

export default {
  Avatar: avatarMap,
  Buttons: buttonsMap,
  Checkbox: checkboxMap,
  ChoiceList: choiceListMap,
  Colors: colorsMap,
  Dropdown: dropdownMap,
  Icon: iconMap,
  Input: inputMap,
  ListItem: listItemMap,
  PopupMenu: popupMenuMap,
  SmallInput: smallInputMap,
  StandardScreen: standardScreenMap,
  TabBar: tabBarMap,
  Terminal: terminalMap,
  Text: textMap,
}
