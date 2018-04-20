// @flow
import * as React from 'react'
import {keyBy} from 'lodash-es'
import type {DumbComponentMap} from '../constants/types/more'
import {
  AutosizeInput,
  Avatar,
  Button,
  Box,
  ChoiceList,
  ListItem,
  Markdown,
  PopupDialog,
  PopupMenu,
  StandardScreen,
  Text,
} from './index'
import {globalStyles, globalColors, isMobile} from '../styles'

// So we can share this between mobile and desktop
const display = type => (isMobile ? {} : {display: type})

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
        <Text style={{color: globalColors.red}} type={'BodySmall'} onClick={() => {}}>
          Action Jack
        </Text>
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
        <Text style={{color: globalColors.red}} type={'BodySmall'} onClick={() => {}}>
          Action Jack
        </Text>
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
  children: (
    <Text type="Header" style={{textAlign: 'center'}}>
      Whoa, look at this centered thing
    </Text>
  ),
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
            You won a unicorn!{' '}
            <Text type="BodySemibold" style={{color: globalColors.white}}>
              Make sure to feed it
            </Text>{' '}
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
    // Disabling this one, it's a visdiff flake.
    // emoji: {
    //  children: 'hello there :santa::skin-tone-3: 🌸😎👍🏿!',
    // },
    'special chars in code block': {
      children: `I think we should try to use \`if else\` statements \`\`\`if (var == "foo")
  echo "foo";
else echo "bar";
  // this should be *asterisk* \`\`\``,
    },
    'Messed up': {
      children:
        'I think we should try to use `if else` statements ```if (var == "foo")\n  echo "foo";\nelse echo "bar";`` I think I *missed something**',
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
        nytimes.json
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
        http://t.co
        t.co
        10.0.0.24
        google.com
        keybase.io/a/user/lookup?one=1&two=2
        keybase.io/a/user/path_with_underscore
        keybase.io?blah=true
        keybase.io/~user/cool
        http://keybase.io/blah/../up-one/index.html
        keybase.io/)(,)?=56,78,910@123
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
  ChoiceList: choiceListMap,
  ListItem: listItemMap,
  Markdown: markdownDumbMap,
  PopupDialog: popupDialogMap,
  PopupMenu: popupMenuMap,
  StandardScreen: standardScreenMap,
}
