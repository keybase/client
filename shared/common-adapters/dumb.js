// @flow
import * as React from 'react'
import {keyBy} from 'lodash-es'
import type {DumbComponentMap} from '../constants/types/more'
import {
  AutosizeInput,
  Avatar,
  Box,
  ChoiceList,
  Markdown,
  PopupDialog,
  PopupMenu,
  StandardScreen,
  Text,
} from './index'
import {globalStyles, globalColors, isMobile} from '../styles'

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
  Markdown: markdownDumbMap,
  PopupDialog: popupDialogMap,
  PopupMenu: popupMenuMap,
}
