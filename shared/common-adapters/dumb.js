// @flow
import React from 'react'
import keyBy from 'lodash/keyBy'
import type {DumbComponentMap} from '../constants/types/more'
import type {IconType} from './icon.constants'
import {
  AutosizeInput,
  Avatar,
  Button,
  Box,
  Checkbox,
  ChoiceList,
  Icon,
  Input,
  ListItem,
  Markdown,
  PopupDialog,
  PopupMenu,
  StandardScreen,
  TabBar,
  Text,
} from './index'
import {TabBarButton, TabBarItem} from './tab-bar'
import {globalStyles, globalColors} from '../styles'
import {iconMeta} from './icon.constants'
import {isMobile} from '../constants/platform'

const onCheck = () => console.log('on check!')
const onClick = () => console.log('on click!')

// So we can share this between mobile and desktop
const display = type => (isMobile ? {} : {display: type})

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
const backgroundModes = [
  'Normal',
  'Terminal',
  'Announcements',
  'Success',
  'Information',
  'HighRisk',
  'Documentation',
]

backgroundModes.forEach(backgroundMode => {
  const backgroundColor = {
    Normal: globalColors.white,
    Terminal: globalColors.darkBlue3,
    Announcements: globalColors.blue,
    Success: globalColors.green,
    Information: globalColors.yellow,
    HighRisk: globalColors.red,
    Documentation: globalColors.darkBlue,
  }[backgroundMode]

  const base = {
    parentProps: {
      style: {
        backgroundColor,
      },
    },
    backgroundMode,
    style: {
      margin: 10,
      minWidth: 320,
      ...display('block'),
    },
  }

  const mocks = {}

  const types = [
    'HeaderBig',
    'Header',
    'HeaderLink',
    'BodyBig',
    'BodyBigLink',
    'Body',
    'BodySemibold',
    'BodySemiboldLink',
    'BodyPrimaryLink',
    'BodySecondaryLink',
    'BodyError',
    'BodySuccess',
    'BodySmall',
    'BodySmallSemibold',
    'BodySmallSemiboldItalic',
    'BodySmallPrimaryLink',
    'BodySmallSecondaryLink',
    'BodySmallError',
    'BodySmallSuccess',
    'BodySemiboldItalic',
    'BodySmallItalic',
    'BodySmallInlineLink',
    'BodySmallSemiboldInlineLink',
    'Terminal',
    'TerminalInline',
    'TerminalComment',
    'TerminalEmpty',
  ]

  types.forEach(type => {
    mocks[type] = {
      ...base,
      type,
      children: type,
    }
  })

  mocks['Body - Wrap'] = {...mocks['Body'], children: 'hello world '.repeat(50)}

  Object.keys(mocks).forEach(key => {
    textMocks[`${key}: ${backgroundMode}`] = mocks[key]
  })
})

const textMap: DumbComponentMap<Text> = {
  component: Text,
  mocks: textMocks,
}

const commonButton = {
  onClick,
}

const buttonsMap: DumbComponentMap<Button> = {
  component: Button,
  mocks: {
    Primary: {
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
    Secondary: {
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
    Danger: {
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
    Follow: {
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
    Following: {
      ...commonButton,
      label: 'Following',
      type: 'Following',
    },
    Unfollow: {
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
      label: 'Primary small',
      type: 'Primary',
      small: true,
    },
    'Secondary small': {
      ...commonButton,
      label: 'Secondary small',
      type: 'Secondary',
      small: true,
    },
    'Danger small': {
      ...commonButton,
      label: 'Danger small',
      type: 'Danger',
      small: true,
    },
    'Follow small': {
      ...commonButton,
      label: 'Follow small',
      type: 'Follow',
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
      label: 'Secondary small',
      type: 'Secondary',
      small: true,
      waiting: true,
    },
    'Danger small waiting': {
      ...commonButton,
      label: 'Danger small',
      type: 'Danger',
      small: true,
      waiting: true,
    },
    'Follow small waiting': {
      ...commonButton,
      label: 'Follow small',
      type: 'Follow',
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

const IconHolder = ({iconFont}) => {
  // $FlowIssue
  const names: Array<IconType> = Object.keys(iconMeta)
  const sizes = names.reduce((map: {[key: string]: Array<IconType>}, name: IconType) => {
    const meta: any = iconMeta[name]
    if (meta.isFont === iconFont) {
      const size = meta.gridSize || 'none'
      if (!map[size]) {
        map[size] = []
      }
      map[size].push(name)
    }
    return map
  }, {})
  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
      }}
    >
      {Object.keys(sizes).map(size => (
        <Box key={size} style={globalStyles.flexBoxColumn}>
          <Text type="HeaderLink">Grid: {size}</Text>
          <Box style={{...globalStyles.flexBoxRow, flexWrap: 'wrap'}}>
            {sizes[size].map((i: IconType) => (
              <Box key={i} style={{...globalStyles.flexBoxColumn, alignItems: 'center', padding: 4}}>
                <Text type="BodySmall">{i}</Text>
                <Icon type={i} style={{margin: 10, ...(isMobile ? {} : {border: 'solid 1px #777777'})}} />
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

// $FlowIssue doesn't like stateless
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
    'Default Filled Center': {
      value: 'Hello, World on yellow!',
      parentProps: {
        style: {
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          width: isMobile ? 420 : 600,
          backgroundColor: 'yellow',
        },
      },
    },
    'Default Filled Stretch': {
      value: 'Hello, World on green!',
      parentProps: {
        style: {
          ...globalStyles.flexBoxColumn,
          alignItems: 'stretch',
          width: isMobile ? 420 : 600,
          backgroundColor: 'green',
        },
      },
    },
    'Default Filled style override': {
      value: 'Hello, World!',
      style: {
        backgroundColor: 'red',
      },
    },
    'Default Filled inputstyle override': {
      value: 'Hello, World!',
      inputStyle: {
        backgroundColor: 'red',
      },
    },
    'Default No underline': {
      value: 'Hello, World!',
      hideUnderline: true,
    },
    'Hint Empty': {
      hintText: 'Hello...',
    },
    'Floating Label Empty': {
      floatingHintTextOverride: 'Hello...',
    },
    'Password filled': {
      floatingHintTextOverride: 'Shh...',
      value: 'Hello, World!',
      type: 'password',
    },
    'Password visible filled': {
      floatingHintTextOverride: 'Shh...',
      value: 'Hello, World!',
      type: 'passwordVisible',
    },
    'Auto cap none': {
      autoCapitalize: 'none',
    },
    'Auto cap sentences': {
      autoCapitalize: 'sentences',
    },
    'Auto cap words': {
      autoCapitalize: 'words',
    },
    'Auto cap characters': {
      autoCapitalize: 'characters',
    },
    Autocorrect: {
      autoCorrect: true,
    },
    'Floating Label Filled': {
      floatingHintTextOverride: 'Hello...',
      value: 'Hello, World!',
    },
    'Floating Label Error': {
      floatingHintTextOverride: 'Hello...',
      value: 'Hello, Worl',
      errorText: 'Check your spelling',
    },
    'Error styled': {
      floatingHintTextOverride: 'Hello...',
      value: 'Hello, Worl',
      errorText: 'Check your spelling',
      errorStyle: {
        backgroundColor: 'blue',
        padding: 20,
      },
    },
    'Floating Label Hint Empty': {
      hintText: 'Hello!',
      floatingHintTextOverride: 'Hello...',
    },
    'Multi Label Styled': {
      hintText: 'Hello!',
      multiline: true,
      value: 'multi styled',
      inputStyle: {
        color: 'blue',
      },
    },
    'Hint Multiline Empty': {
      hintText: 'This is a very long hint that will hopefully wrap to two lines or more more more!',
      multiline: true,
    },
    'Long Multiline': {
      value: 'This is a very long text that will hopefully wrap to two lines or more more more! or more or more or more or more or more or more or more or more or more or more or more or more or more or more!',
      multiline: true,
    },
    'Long Multiline rowsMax1': {
      value: 'This is a very long text that will hopefully wrap to two lines or more more more! or more or more or more or more or more or more or more or more or more or more or more or more or more or more!',
      multiline: true,
      rowsMax: 1,
    },
    'Long Multiline rowsMax2': {
      value: 'This is a very long text that will hopefully wrap to two lines or more more more! or more or more or more or more or more or more or more or more or more or more or more or more or more or more!',
      multiline: true,
      rowsMax: 2,
    },
    'Long Multiline rowsMax4': {
      value: 'This is a very long text that will hopefully wrap to two laxes or more more more! or more or more or more or more or more or more or more or more or more or more or more or more or more or more!',
      multiline: true,
      rowsMax: 4,
    },
    'Long Multiline rowsMin2Max4 small': {
      value: 'This is a small text',
      multiline: true,
      rowsMin: 2,
      rowsMax: 4,
    },
    'Long Multiline rowsMin2Max4 long': {
      value: 'This is a very long text that will hopefully wrap to two lines or more more more! or more or more or more or more or more or more or more or more or more or more or more or more or more or more!',
      multiline: true,
      rowsMin: 2,
      rowsMax: 4,
    },
    'Long Multiline rowsMin1': {
      value: 'This is a small text',
      multiline: true,
      rowsMin: 1,
    },
    'Long Multiline rowsMin2': {
      value: 'This is a small text',
      multiline: true,
      rowsMin: 2,
    },
    'Long Multiline rowsMin4': {
      value: 'This is a small text',
      multiline: true,
      rowsMin: 4,
    },
    'Multiline error': {
      value: 'This is a multiline with error',
      multiline: true,
      errorText: 'this is an error',
    },
    'Floating Label Multiline Empty': {
      floatingHintTextOverride: 'Hello...',
      multiline: true,
    },
    'Floating Label Multiline Filled': {
      floatingHintTextOverride: 'Hello...',
      multiline: true,
      value: 'Hello, World!',
    },
    'Floating Label Multiline Filled Long': {
      floatingHintTextOverride: 'Hello...',
      multiline: true,
      value: 'Hello,\nMy name is Max\nHow are you?',
    },
    'Small Empty': {
      small: true,
      smallLabel: 'Small:',
    },
    'Small Filled': {
      small: true,
      value: 'Hello, World!',
      smallLabel: 'Small:',
    },
    'Small styled': {
      small: true,
      value: 'Hello, World!',
      smallLabel: 'Small:',
      inputStyle: {
        color: 'blue',
      },
    },
    'Small Hint Empty': {
      small: true,
      smallLabel: 'Small:',
      hintText: 'Hello...',
    },
    'Small Label Empty': {
      small: true,
      hintText: 'Hello...',
    },
    'Small Label Styled': {
      small: true,
      smallLabel: 'Styled:',
      smallLabelStyle: {
        backgroundColor: 'blue',
      },
      hintText: 'Hello...',
    },
    'Small Hint Error': {
      small: true,
      smallLabel: 'Small:',
      value: 'has an error',
      hintText: 'Hello...',
      errorText: 'this is invisible in the small input',
    },
  },
}

const tabBarCustomButtons = selectedIndex => {
  const IconButton = ({selected, icon, badgeNumber, label}: any) => (
    <TabBarButton
      label={label}
      source={{type: 'icon', icon}}
      selected={selected}
      badgeNumber={badgeNumber}
      style={{height: 40}}
    />
  )
  const AvatarButton = ({selected, avatar, badgeNumber}: any) => (
    <TabBarButton
      source={{type: 'avatar', username: 'max'}}
      selected={selected}
      badgeNumber={badgeNumber}
      style={{flex: 1}}
      styleContainer={{height: 40}}
    />
  )

  return {
    style: {flex: 1, ...display('flex'), ...globalStyles.flexBoxRow, height: 580},
    styleTabBar: {
      justifyContent: 'flex-start',
      width: 160,
      backgroundColor: globalColors.midnightBlue,
      ...globalStyles.flexBoxColumn,
    },
    children: [
      {avatar: <Avatar size={32} onClick={null} username="max" />},
      {icon: 'iconfont-people', label: 'PEOPLE', badgeNumber: 3},
      {icon: 'iconfont-folder', label: 'FOLDERS'},
      {icon: 'iconfont-device', label: 'DEVICES', badgeNumber: 12},
      {icon: 'iconfont-settings', label: 'SETTINGS'},
    ].map((buttonInfo: any, i) => {
      const button = buttonInfo.avatar
        ? <AvatarButton
            badgeNumber={buttonInfo.badgeNumber}
            selected={selectedIndex === i}
            avatar={buttonInfo.avatar}
          />
        : <IconButton
            icon={buttonInfo.icon}
            label={buttonInfo.label}
            badgeNumber={buttonInfo.badgeNumber}
            selected={selectedIndex === i}
          />
      return (
        <TabBarItem
          key={i}
          tabBarButton={button}
          styleContainer={{...display('flex')}}
          selected={selectedIndex === i}
          onClick={() => console.log('TabBaritem:onClick')}
        >
          <Text type="Header" style={{flex: 1}}>Content here at: {i}</Text>
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
    'Small list item with icon (desktop only)': {
      type: 'Small',
      icon: <Box style={{height: 24, width: 24, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Button label={'Action'} type={'Primary'} onClick={() => {}} />,
    },
    'Small list item with button action': {
      type: 'Small',
      swipeToAction: true,
      icon: <Box style={{height: 32, width: 32, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: <Button label={'Action'} type={'Primary'} onClick={() => {}} />,
    },
    'Small list item with avatar 40 (mobile only)': {
      type: 'Small',
      icon: <Box style={{height: 40, width: 40, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      swipeToAction: true,
      action: <Button label={'Action'} type={'Primary'} onClick={() => {}} />,
    },
    'Small list item with text action': {
      type: 'Small',
      icon: <Box style={{height: 32, width: 32, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: (
        <Text style={{color: globalColors.red}} type={'BodySmall'} onClick={() => {}}>Action Jack</Text>
      ),
      swipeToAction: true,
      extraRightMarginAction: true,
    },
    'Large list item with Button': {
      type: 'Large',
      icon: <Box style={{height: 48, width: 48, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      swipeToAction: true,
      action: <Button label={'Action'} type={'Primary'} onClick={() => {}} />,
    },
    'Large list item with text action': {
      type: 'Large',
      icon: <Box style={{height: 48, width: 48, backgroundColor: globalColors.black_20}} />,
      body: <Box style={{backgroundColor: globalColors.black_20, flex: 1}} />,
      action: (
        <Text style={{color: globalColors.red}} type={'BodySmall'} onClick={() => {}}>Action Jack</Text>
      ),
      extraRightMarginAction: true,
    },
  },
}

const popupCommon = {
  parentProps: isMobile
    ? {style: {height: 300}}
    : {style: {border: 'solid 1px black', position: 'relative', height: 300}},
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
        {
          ...popupItemCommon,
          title: 'Clear history (3.24 MB)',
          subTitle: 'Deletes old copies of files.',
          danger: true,
        },
        {
          ...popupItemCommon,
          title: 'Delete files and clear history (5.17GB)',
          subTitle: 'Deletes everything in this folder, including its backup versions',
          danger: true,
        },
      ],
    },
  },
}

const avatarSizes = [176, 112, 80, 64, 48, 40, 32, 24, 16]
const mockAvatarSizes = (title, modifiers) =>
  keyBy(
    avatarSizes.map(size => ({size, username: 'awendland', ...modifiers})),
    props => `${title} x${props.size}`
  )

const avatarMap: DumbComponentMap<Avatar> = {
  component: Avatar,
  mocks: {
    ...mockAvatarSizes('Normal', {}),
    ...mockAvatarSizes('Fallback', {username: 'FALLBACK'}),
    ...mockAvatarSizes('Following', {
      following: true,
    }),
    ...mockAvatarSizes('Follows You', {
      followsYou: true,
    }),
    ...mockAvatarSizes('Mutual Follow', {
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
  children: <Text type="Header" style={{textAlign: 'center'}}>Whoa, look at this centered thing</Text>,
  parentProps: {style: {...display('flex'), height: 578}},
}

const standardScreenMap: DumbComponentMap<StandardScreen> = {
  component: StandardScreen,
  mocks: {
    Normal: {
      ...standardScreenProps,
    },
    Error: {
      ...standardScreenProps,
      notification: {
        message: 'Something went horribly wrong! :-(',
        type: 'error',
      },
    },
    'Success w/ Custom Notification Element': {
      ...standardScreenProps,
      notification: {
        message: (
          <Text type="BodySemibold" style={{color: globalColors.white}}>
            You won a unicorn!
            {' '}
            <Text type="BodySemibold" style={{color: globalColors.white}}>Make sure to feed it</Text>
            {' '}
            :-)
          </Text>
        ),
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

const markdownDumbMap: DumbComponentMap<Markdown> = {
  component: Markdown,
  mocks: {
    Normal: {
      children: `I think we should try to use \`if else\` statements \`\`\`
if (var == "foo")
  echo "foo";
else echo "bar";\`\`\`How about *bold* and _italic?_ nice. :smile:
Now youre thinking with ~portals~ crypto.
how about ~_*bold and italic and strike through?*_~ - now - _*some bold* and just italic_ bold.*with*.punctuation!`,
    },
    emoji: {
      children: 'hello there :santa::skin-tone-3: 🌸😎👍🏿!',
    },
    'special chars in code block': {
      children: `I think we should try to use \`if else\` statements \`\`\`if (var == "foo")
  echo "foo";
else echo "bar";
  // this should be *asterisk* \`\`\``,
    },
    'Messed up': {
      children: 'I think we should try to use `if else` statements ```if (var == "foo")\n  echo "foo";\nelse echo "bar";`` I think I *missed something**',
    },
    'Escaped chars': {
      children: '\\*foo\\* I should see asterisks',
    },
    links: {
      children: `
  Ignore:
    a...b,
    ftp://blah.com,
    gopher://blah.com,
    mailto:blah@blah.com
  Include:
    http://keybase.io
    http://keybase.io/
    *http://keybase.io*
    *http://keybase.io/~test*
    _http://keybase.io_
    ~http://keybase.io~
    \`http://keybase.io\`
    (https://keybase.io)
    https://keybase.io
    HTTP://cnn.com
    http://twitter.com
    google.com
    keybase.io/a/user/lookup?one=1&two=2
    keybase.io/a/user/path_with_underscore
    keybase.io?blah=true
    keybase.io/~user/cool
    http://keybase.io/blah/../up-one/index.html
  These should have the trailing punctuation outside the link:
    amazon.co.uk.
    keybase.io,
    keybase.io.
    keybase.io?
    *http://keybase.io/*.
    *http://keybase.io/~_*
`,
    },
    Quotes: {
      children: `> this is quoted
> this is _italics_ inside of a quote. This is *bold* inside of a quote.
> outside code: \`This is an inline block of code in a quote\` outside again
> \`\`\`
multi
line
code in quote
\`\`\`
`,
    },
    'Code block': {
      children: `
        \`\`\`this is a code block\`\`\`
\`\`\`
this is a code block that starts with a newline\`\`\`
\`\`\`
this is a code block that starts with a newline and ends with a newline
\`\`\`
\`\`\`

this is a code block with two newline above\`\`\`
`,
    },
    'Blank lines': {
      children: `

        hello


        world


      `,
    },
  },
}
const popupDialogMap: DumbComponentMap<PopupDialog> = {
  component: PopupDialog,
  mocks: {
    Normal: {
      onClose: () => console.log('PopupDialog: onClose'),
      children: (
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            width: 200,
            height: 200,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: globalColors.white,
          }}
        >
          <Text type="Body">Hello, world!</Text>
        </Box>
      ),
      parentProps: {
        style: {
          position: 'relative',
          width: 300,
          height: 300,
        },
      },
    },
  },
}
const autosizeInputMap: DumbComponentMap<AutosizeInput> = {
  component: AutosizeInput,
  mocks: {
    Normal: {
      value: 'here is some long text',
      placeholder: '',
      onChange: text => {
        console.log('input text changed:', text)
      },
    },
    Placeholder: {
      value: '',
      placeholder: 'Type here...',
      onChange: text => {
        console.log('input text changed:', text)
      },
    },
    Styled: {
      value: 'styled inputs work too!',
      placeholder: '',
      inputStyle: {
        backgroundColor: 'papayawhip',
        borderWidth: 2,
        fontSize: 20,
        padding: 10,
      },
      onChange: text => {
        console.log('input text changed:', text)
      },
    },
  },
}
export default {
  AutosizeInput: autosizeInputMap,
  Avatar: avatarMap,
  Buttons: buttonsMap,
  Checkbox: checkboxMap,
  ChoiceList: choiceListMap,
  Colors: colorsMap,
  Icon: iconMap,
  Input: inputMap,
  ListItem: listItemMap,
  Markdown: markdownDumbMap,
  PopupDialog: popupDialogMap,
  PopupMenu: popupMenuMap,
  StandardScreen: standardScreenMap,
  TabBar: tabBarMap,
  Text: textMap,
}
