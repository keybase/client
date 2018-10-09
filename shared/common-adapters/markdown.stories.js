// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Sb from '../stories/storybook'
import * as Kb from './index'
import Markdown, {parser} from './markdown'
import OriginalParser from '../markdown/parser'

const cases = {
  debugging: `
  keybase.io/a/user/lookup?one=1&two=2
  keybase.io/a/user/path_with_underscore
  keybase.io?blah=true
  keybase.io/~user/cool
  http://keybase.io/blah/../up-one/index.html
  `,
  paragraphs: `this is a sentence.
this is the next line
and another with two below

this is the one below.`,
  normal: `I think we should try to use \`if else\` statements \`\`\`
if (var == "foo")
  echo "foo";
else echo "bar";\`\`\` How about *bold* and _italic?_ nice. :smile:
a whole bunch of native emojis 😀 😁 😍 ☝️ ☎️
a whole bunch of string emojis :thumbsup: :cry: :fireworks:
Now youre thinking with ~portals~ crypto.
how about ~_*bold and italic and strike through?*_~ - now - _*some bold* and just italic_ bold.*with*.punctuation!`,
  'special chars in code block': `I think we should try to use \`if else\` statements \`\`\`if (var == "foo")
  echo "foo";
else echo "bar";
  // this should be *asterisk* \`\`\``,
  'Messed up':
    'I think we should try to use `if else` statements ```if (var == "foo")\n  echo "foo";\nelse echo "bar";`` I think I *missed something**',
  'Escaped chars': '\\*foo\\* I should see asterisks',
  links: `
Ignore:
  a...b,
  ftp://blah.com,
  gopher://blah.com,
  mailto:blah@blah.com
  nytimes.json
Include:
  http://abc.io
  http://cbs.io/
  *http://cnn.io*
  *http://fox.io/~test*
  _http://dog.io_
  ~http://cat.io~
  \`http://orange.io\`
  (https://yellow.io)
  https://green.io
  HTTP://blue.com
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
  Quotes: `> this is quoted
> this is _italics_ inside of a quote. This is *bold* inside of a quote.
> outside code: \`This is an inline block of code in a quote\` outside again
> \`\`\`
multi
line
code in quote
\`\`\`
`,
  'Quotes 2': `> this is quoted
> this is _italics_ inside of a quote. This is *bold* inside of a quote.
> outside code: \`This is an inline block of code in a quote\` outside again




something unrelated

> Separate paragraph
`,
  'Quotes 3': `> _foo_ and *bar*! \`\`\`
a = 1
\`\`\`
`,
  'Quotes 4': `> one _line_ *quote*`,
  'NOJIMACode block': `\`\`\`

this is a code block with two newline above\`\`\``,
  'Code block': `\`\`\`this is a code block\`\`\`
\`\`\`
this is a code block that starts with a newline\`\`\`
\`\`\`
this is a code block that starts with a newline and ends with a newline
\`\`\`
\`\`\`

this is a code block with two newline above\`\`\`
`,
  'Blank lines': `

        hello


        world


      `,
  bigemoji: ':thumbsup::100:',
}

const dummyMeta = {
  mentionsChannelName: I.Map({
    general: '0000bbbbbbbbbbbbbbaaaaaaaaaaaaadddddddddccccccc0000000ffffffeeee',
  }),
  mentionsChannel: 'all',
  mentionsAt: I.Set(['following', 'notFollowing', 'myUsername', 'noTheme']),
}

const mocksWithMeta = {
  'Channel Name Mention': {
    text: 'Hey! I *just* posted a video of my sick jump on #general',
    meta: dummyMeta,
  },
  'User mention - Following': {
    text: 'Hey @following, are you still there?',
    meta: dummyMeta,
  },
  'User mention - Not Following': {
    text: 'Hey @notFollowing, are you still there?',
    meta: dummyMeta,
  },
  'User mention - You': {
    text: 'Hey @myUsername, are you still there?',
    meta: dummyMeta,
  },
  'User mention - No Theme': {
    text: 'Hey @noTheme, are you still there?',
    meta: dummyMeta,
  },
  'Channel Mention': {
    text: `Hey @channel, theres *FREE* pizza in the kitchen!`,
    meta: dummyMeta,
  },
}

const provider = Sb.createPropProviderWithCommon({})

class ShowAST extends React.Component<{text: string, simple: boolean}, {visible: boolean}> {
  state = {visible: false}
  render = () => {
    const parsed = this.props.simple
      ? parser((this.props.text || '') + '\n', {inline: false, disableAutoBlockNewlines: true})
      : OriginalParser.parse(this.props.text, {
          channelNameToConvID: (channel: string) => null,
          isValidMention: (mention: string) => false,
        })

    return (
      <Kb.Box2 direction="vertical">
        <Kb.Button
          onClick={() => this.setState({visible: !this.state.visible})}
          label={`${this.state.visible ? 'Hide' : 'Show'} AST`}
          type="Primary"
        />
        {this.state.visible && <Markdown>{'```\n' + JSON.stringify(parsed, null, 2) + '\n```'}</Markdown>}
      </Kb.Box2>
    )
  }
}

class ShowPreview extends React.Component<{text: string, simple: boolean}, {visible: boolean}> {
  state = {visible: true}
  render = () => {
    return (
      <Kb.Box2 direction="vertical">
        <Kb.Button
          onClick={() => this.setState({visible: !this.state.visible})}
          label={`${this.state.visible ? 'Hide' : 'Show'} Preview`}
          type="Primary"
        />
        {this.state.visible && (
          <Markdown simple={this.props.simple} preview={true}>
            {this.props.text}
          </Markdown>
        )}
      </Kb.Box2>
    )
  }
}

const MarkdownWithAst = ({children, simple, meta}) => (
  <Kb.Box2 direction="vertical">
    <Markdown simple={simple} meta={meta}>
      {children}
    </Markdown>
    <ShowAST text={children} simple={simple} />
    <ShowPreview text={children} simple={simple} />
  </Kb.Box2>
)

const load = () => {
  let s = Sb.storiesOf('Common/Markdown', module)
    .addDecorator(provider)
    .addDecorator(Sb.scrollViewDecorator)

  Object.keys(cases).forEach(k => {
    s = s.add(k + '[s]', () => <MarkdownWithAst simple={true}>{cases[k]}</MarkdownWithAst>)
    s = s.add(k + '[o]', () => <MarkdownWithAst simple={false}>{cases[k]}</MarkdownWithAst>)
  })

  Object.keys(mocksWithMeta).forEach(k => {
    s = s.add(k + '[s]', () => (
      <MarkdownWithAst simple={true} meta={mocksWithMeta[k].meta}>
        {mocksWithMeta[k].text}
      </MarkdownWithAst>
    ))
    s = s.add(k + '[o]', () => (
      <MarkdownWithAst simple={false} meta={mocksWithMeta[k].meta}>
        {mocksWithMeta[k].text}
      </MarkdownWithAst>
    ))
  })
}

export default load
