// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import Markdown from './markdown'

const cases = {
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
  Quotes: `> this is quoted
> this is _italics_ inside of a quote. This is *bold* inside of a quote.
> outside code: \`This is an inline block of code in a quote\` outside again
> \`\`\`
multi
line
code in quote
\`\`\`
`,
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
}

const load = () => {
  let s = Sb.storiesOf('Common/Markdown', module).addDecorator(Sb.scrollViewDecorator)

  Object.keys(cases).forEach(k => {
    s = s.add(k + '[s]', () => <Markdown simple={true}>{cases[k]}</Markdown>)
    s = s.add(k + '[o]', () => <Markdown simple={false}>{cases[k]}</Markdown>)
  })
}

export default load
