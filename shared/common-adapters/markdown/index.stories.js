// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as ChatConstants from '../../constants/chat2'
import * as Sb from '../../stories/storybook'
import * as Kb from '../index'
import {escapePath} from '../../constants/fs'
import {stringToPath} from '../../constants/types/fs'
import Markdown, {type MarkdownMeta} from '.'
import {simpleMarkdownParser} from './shared'

const cases = {
  'Blank lines': `

        hello


        world


      `,
  'Code block': `\`\`\`this is a code block\`\`\`
\`\`\`
this is a code block that starts with a newline\`\`\`
\`\`\`
this is a code block that starts with a newline and ends with a newline
\`\`\`
\`\`\`

this is a code block with two newline above\`\`\`
`,
  'Escaped chars': '\\*foo\\* I should see asterisks',
  'Messed up':
    'I think we should try to use `if else` statements ```if (var == "foo")\n  echo "foo";\nelse echo "bar";`` I think I *missed something**',
  'NOJIMACode block': `\`\`\`

this is a code block with two newline above\`\`\``,
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
  'Quotes 5': `> text here and a \`\`\`code blcok\`\`\``,
  'Quotes 6': `> \`\`\`code block\`\`\``,
  'Quotes super nested': `> > > > > > > > > foo bar`,
  accidentalBoldLists: `
  List of this:
   * a
   * b
   * c
  `,
  bigemoji: ':thumbsup::100:',
  boldweirdness: `How are you *today*?`,
  breakTextsOnSpaces: `Text words should break on spaces so that google.com can be parsed by the link parser.`,
  debugging: `\` \` hi \` \``,
  inlineCodeWeirdness: `\` \` hi \` \``,
  inlineCodeWeirdness2: `\` \` hi \n\` \``,
  kbfsPaths: `
      /keybase ha
      /keybase/哟
      before/keybase
      之前/keybase
      /keybase/private /keybase
      /keybase/public
      /keybase/team
      /keybase/private/
      /keybase/team/keybase
      /keybase/team/keybase/blahblah
      ${escapePath(stringToPath('/keybase/team/keybase/blah blah blah'))}
      ${escapePath(stringToPath('/keybase/team/keybase/blah\\blah\\blah'))}
      /keybase/team/keybase/blahblah/
      /keybase/private/songgao/🍻
      /keybase/private/songgao/🍻/🍹.png/
      /keybase/private/songgao/囧/yo
      /keybase/private/songgao,strib#jzila,jakob223/file
      /keybase/private/songgao,strib#jzila/file
      /keybase/private/song-gao,strib#jzila/file
      /keybase/team/keybase,blah
      /keybase/team/keybase.blah
      /keybaseprivate
      /keybaseprivate/team
      /keybase/teamaa/keybase
      /foo
      /keybase`,
  links: `
Ignore:
  a...b,
  ftp://blah.com,
  gopher://blah.com,
  mailto:blah@blah.com
  nytimes.json
Include:
  https://maps.google.com?q=Goddess%20and%20the%20Baker,%20Legacy%20Tower,%20S%20Wabash%20Ave,%20Chicago,%20IL%2060603&ftid=0x880e2ca4623987cb:0x8b9a49f6050a873a&hl=en-US&gl=us
  http://abc.io
  http://cbs.io/
  Http://cbs.io/
  HTTP://cbs.io/
  Https://cbs.io/
  HTTPs://cbs.io/
  httpS://cbs.io/
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
  https://10.0.0.24
  google.com
  keybase.io/a/user/lookup?one=1&two=2
  keybase.io/a/user/path_with_underscore
  keybase.io?blah=true
  keybase.io/~user/cool
  http://keybase.io/blah/../up-one/index.html
  keybase.io/)(,)?=56,78,910@123
  abc subdomain.domain.com
  https://www.google.com/maps/place/85+Broad+St,+New+York,+NY+10004/@40.7040702,-74.0133343,17z/data=!3m1!4b1!4m5!3m4!1s0x89c25a141703be89:0x74c637bf3f5d8f7d!8m2!3d40.7040662!4d-74.0111456
Internationalized Domain Names:
  the 'a' in http://ebаy.com isn't an ascii 'a'
  https://www.google.com/search?q=ebаy the params should be allowed
These should have the trailing punctuation outside the link:
  amazon.co.uk.
  keybase.io,
  keybase.io.
  http://keybase.io/mikem,
  http://keybase.io/mikem;
  http://keybase.io/mikem:
  http://keybase.io/mikem!
  keybase.io?
  *http://keybase.io/*.
  *http://keybase.io/~_*
Paranthesis stuff:
  https://en.wikipedia.org/wiki/J/Z_(New_York_City_Subway_service)
  (https://keybase.io/)
`,
  mailto: `email bob@keybase.io`,
  nonemoji: `:party-parrot:`,
  normal: `I think we should try to use \`if else\` statements \`\`\`
if (var == "foo")
  echo "foo";
else echo "bar";\`\`\`
     How about *bold* and _italic?_ nice. :smile:
a whole bunch of native emojis 😀 😁 😍 ☝️ ☎️
a whole bunch of string emojis :thumbsup: :cry: :fireworks:
Now youre thinking with ~portals~ crypto.
how about ~_*bold and italic and strike through?*_~ - now - _*some bold* and just italic_ bold.*with*.punctuation!`,
  paragraphs: `this is a sentence.
this is the next line
and another with two below

this is the one below.`,
  quoteInParagraph: `Do you remember when you said:
> Where do I make the left turn?`,
  'special chars in code block': `I think we should try to use \`if else\` statements \`\`\`if (var == "foo")
  echo "foo";
else echo "bar";
  // this should be *asterisk* \`\`\``,
  transparentEmojis: ` 😀 😁 😍 ☝️ `,
  transparentEmojis2: `these should be solid 😀 😁 😍 ☝️ `,
  transparentEmojis3: `😶`,
  underscoreweirdness: `under_score the first, \`under_score the second\``, // <--- end of string
}

const mockMeta = {
  mentionsAt: I.Set(['following', 'notFollowing', 'myUsername', 'noTheme']),
  mentionsChannel: 'all',
  mentionsChannelName: I.Map({
    // $ForceType
    general: '0000bbbbbbbbbbbbbbaaaaaaaaaaaaadddddddddccccccc0000000ffffffeeee',
  }),
  message: ChatConstants.makeMessageText(),
}

const mocksWithMeta = {
  'Channel Mention': {
    meta: mockMeta,
    text: `Hey @channel, theres *FREE* pizza in the kitchen!`,
  },
  'Channel Name Mention': {
    meta: mockMeta,
    text: 'Hey! I *just* posted a video of my sick jump on #general',
  },
  'User mention - Edge cases': {
    meta: {
      ...mockMeta,
      // This is here to test that the regex is properly not picking up some of these
      mentionsAt: I.Set([
        'valid_',
        '_not',
        'either',
        'this_is',
        'this',
        'aa',
        'a_',
        'a',
        'long_username',
        '01234567890abcdef',
        'you',
      ]),
    },
    text: `hi @you, I hope you're doing well.

this is @valid_

this is @_not

this isn't@either

@this_is though

and @this!

this is the smallest username @aa and @a_ this is too small @a

this is a @long_username

this is too long: @01234567890abcdef`,
  },
  'User mention - Following': {
    meta: mockMeta,
    text: 'Hey @following, are you still there?',
  },
  'User mention - No Theme': {
    meta: mockMeta,
    text: 'Hey @noTheme, are you still there?',
  },
  'User mention - Not Following': {
    meta: mockMeta,
    text: 'Hey @notFollowing, are you still there?',
  },
  'User mention - You': {
    meta: mockMeta,
    text: 'Hey @myUsername, are you still there?',
  },
}

const perfTestCase = new RegExp(`
(((>? Hi (Chris|Strib|Cecile), How are you doing (\\*Today\\*|_This week_)\\?\\n){2}\
|(>? Inline code: \`[A-Z][a-z]{5} = \\d{1,10}\`)\
|(>? This should be  \\\\_escaped\\\\_)\
|(>? \`\`\`
  [A-Z][a-z]{5} = \\d{1,10}
  if \\([A-Z][a-z]{5}\\) {
    // \\*!Important\\*
    console\\.log\\("[a-z]{8}"\\)
  }
\`\`\`)\
|( *> * A quote!)\
|(>? Strikethrough ~[a-z]{3,50}~)\
|(>? Emojis (?::couple_with_heart:|:wedding:|:heartbeat:|:broken_heart:|:two_hearts:|:sparkling_heart:|:heartpulse:|:cupid:|:blue_heart:|:green_heart:|\ud83c\uddf5\ud83c\uddf9|\ud83e\udd3c\u200d\u2640|\ud83c\uddf5\ud83c\uddfc|\ud83e\udd39\ud83c\udfff|\ud83d\udea3\u200d\u2640|\ud83e\udd39\ud83c\udffe|\ud83e\udd39\ud83c\udffd|\ud83e\udd39\ud83c\udffc|\ud83e\udd39\ud83c\udffb|\ud83e\udd39\u200d\u2642|\ud83c\uddf5\ud83c\uddfe|\ud83d\ude4f\ud83c\udfff|\ud83d\ude4f\ud83c\udffe|\ud83d\ude4f\ud83c\udffd|\ud83d\ude4f\ud83c\udffc|\ud83d\ude4f\ud83c\udffb|\ud83d\ude4e\ud83c\udfff))\
|(>? \`\`\`
 (?::couple_with_heart:|:wedding:|:heartbeat:|:broken_heart:|:two_hearts:|:sparkling_heart:|:heartpulse:|:cupid:|:blue_heart:|:green_heart:|\ud83c\uddf5\ud83c\uddf9|\ud83e\udd3c\u200d\u2640|\ud83c\uddf5\ud83c\uddfc|\ud83e\udd39\ud83c\udfff|\ud83d\udea3\u200d\u2640|\ud83e\udd39\ud83c\udffe|\ud83e\udd39\ud83c\udffd|\ud83e\udd39\ud83c\udffc|\ud83e\udd39\ud83c\udffb|\ud83e\udd39\u200d\u2642|\ud83c\uddf5\ud83c\uddfe|\ud83d\ude4f\ud83c\udfff|\ud83d\ude4f\ud83c\udffe|\ud83d\ude4f\ud83c\udffd|\ud83d\ude4f\ud83c\udffc|\ud83d\ude4f\ud83c\udffb|\ud83d\ude4e\ud83c\udfff)
 \`\`\`)\
|(>? \` (?::couple_with_heart:|:wedding:|:heartbeat:|:broken_heart:|:two_hearts:|:sparkling_heart:|:heartpulse:|:cupid:|:blue_heart:|:green_heart:|\ud83c\uddf5\ud83c\uddf9|\ud83e\udd3c\u200d\u2640|\ud83c\uddf5\ud83c\uddfc|\ud83e\udd39\ud83c\udfff|\ud83d\udea3\u200d\u2640|\ud83e\udd39\ud83c\udffe|\ud83e\udd39\ud83c\udffd|\ud83e\udd39\ud83c\udffc|\ud83e\udd39\ud83c\udffb|\ud83e\udd39\u200d\u2642|\ud83c\uddf5\ud83c\uddfe|\ud83d\ude4f\ud83c\udfff|\ud83d\ude4f\ud83c\udffe|\ud83d\ude4f\ud83c\udffd|\ud83d\ude4f\ud83c\udffc|\ud83d\ude4f\ud83c\udffb|\ud83d\ude4e\ud83c\udfff)\`)\
|(>? Check out \\*This url!\\* ((https?:\\/\\/)?[\\w-]{3,10}(\\.(bofa|bom|bond|boo|book|booking|bosch|bostik|boston|bot|boutique|box|br|bradesco|bridgestone|broadway|broker|brother|brussels|bs|bt|budapest|bugatti|build|builders|business|buy|buzz|bv|bw|by|bz|bzh|ca|cab|cafe|cal|call|calvinklein|cam|camera|camp|cancerresearch|canon|capetown|capital|capitalone|car|caravan|cards|care|career|careers|cars|cartier|casa|case|caseih|cash|casino|cat))(:\\d{3,6})?(\\/[a-z]{0,10})?)\\b))\n){80}
`)

const generateCase = (seed: string) => {
  const random = new Sb.Rnd(seed)
  return random.generateString(perfTestCase)
}

const randomGenerated = {
  'Case 1': generateCase('case 1'),
  'Case 2': generateCase('case 2'),
  'Case 3': generateCase('case 3'),
  'Case 4': generateCase('case 4'),
  'Case 5': generateCase('case 5'),
  'Case 6': generateCase('case 6'),
}

export const provider = Sb.createPropProviderWithCommon({})

class ShowAST extends React.Component<{text: string, meta: ?MarkdownMeta}, {visible: boolean}> {
  state = {visible: false}
  render = () => {
    let parsed
    try {
      parsed = simpleMarkdownParser((this.props.text || '').trim() + '\n', {
        disableAutoBlockNewlines: true,
        inline: false,
        markdownMeta: this.props.meta,
      })
    } catch (error) {
      parsed = {error}
    }

    return (
      <Kb.Box2 direction="vertical">
        <Kb.Button
          onClick={() => this.setState({visible: !this.state.visible})}
          label={`${this.state.visible ? 'Hide' : 'Show'} AST`}
          type="Primary"
        />
        {this.state.visible && (
          <Markdown>
            {'```\n' +
              JSON.stringify(
                parsed,
                // Format so the type comes first and the content is ellipsized
                (k, v) =>
                  k === 'type'
                    ? v
                    : typeof v === 'string'
                    ? v.substr(0, 8) + (v.length > 8 ? '...' : '')
                    : Array.isArray(v)
                    ? v.map(o => ({content: o.content, type: o.type}))
                    : v,
                2
              ) +
              '\n```'}
          </Markdown>
        )}
      </Kb.Box2>
    )
  }
}

class ShowPreview extends React.Component<{text: string, meta: ?MarkdownMeta}, {visible: boolean}> {
  state = {visible: false}
  render = () => {
    return (
      <Kb.Box2 direction="vertical">
        <Kb.Button
          onClick={() => this.setState({visible: !this.state.visible})}
          label={`${this.state.visible ? 'Hide' : 'Show'} Preview`}
          type="Primary"
        />
        {this.state.visible && (
          <Markdown preview={true} meta={this.props.meta}>
            {this.props.text}
          </Markdown>
        )}
      </Kb.Box2>
    )
  }
}

// Adds the perf decorator and disables showing previews and ast
const PERF_MODE = false

const MarkdownWithAst = ({children, meta}: {children: any, meta?: ?MarkdownMeta}) =>
  PERF_MODE ? (
    <Markdown meta={meta}>{children}</Markdown>
  ) : (
    <Kb.Box2 direction="vertical">
      <Markdown meta={meta}>{children}</Markdown>
      <ShowAST text={children} meta={meta} />
      <ShowPreview text={children} meta={meta} />
    </Kb.Box2>
  )

const load = () => {
  let s = Sb.storiesOf('Common/Markdown', module)
    .addDecorator(provider)
    .addDecorator(Sb.scrollViewDecorator)

  if (PERF_MODE) {
    s.addDecorator(Sb.perfDecorator())
  }

  Object.keys(cases).forEach(k => {
    s = s.add(k, () => <MarkdownWithAst>{cases[k]}</MarkdownWithAst>)
  })

  Object.keys(mocksWithMeta).forEach(k => {
    s = s.add(k, () => (
      <MarkdownWithAst meta={mocksWithMeta[k].meta}>{mocksWithMeta[k].text}</MarkdownWithAst>
    ))
  })

  Object.keys(randomGenerated).forEach(k => {
    s = s.add(k + '[comparison]', () => (
      <Kb.Box2 direction="horizontal">
        <Markdown style={{flex: 1}}>{randomGenerated[k]}</Markdown>
        <Kb.Box style={{backgroundColor: 'black', width: 1}} />
        <Kb.Text style={{flex: 1}} type="Body">
          {JSON.stringify(randomGenerated[k])}
        </Kb.Text>
      </Kb.Box2>
    ))
    s = s.add(k, () => <MarkdownWithAst>{randomGenerated[k]}</MarkdownWithAst>)
  })
}

export default load
