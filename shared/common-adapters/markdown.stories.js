// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import Markdown from './markdown'

const load = () => {
  Sb.storiesOf('Common/Markdown', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Normal', () => (
      <Markdown>
        {`I think we should try to use \`if else\` statements \`\`\`
if (var == "foo")
  echo "foo";
else echo "bar";\`\`\`How about *bold* and _italic?_ nice. :smile:
Now youre thinking with ~portals~ crypto.
how about ~_*bold and italic and strike through?*_~ - now - _*some bold* and just italic_ bold.*with*.punctuation!`}
      </Markdown>
    ))
    .add('special chars in code block', () => (
      <Markdown>{`I think we should try to use \`if else\` statements \`\`\`if (var == "foo")
  echo "foo";
else echo "bar";
  // this should be *asterisk* \`\`\``}</Markdown>
    ))
    .add('Messed up', () => (
      <Markdown>
        {
          'I think we should try to use `if else` statements ```if (var == "foo")\n  echo "foo";\nelse echo "bar";`` I think I *missed something**'
        }
      </Markdown>
    ))
    .add('Escaped chars', () => <Markdown>{'\\*foo\\* I should see asterisks'}</Markdown>)
    .add('links', () => (
      <Markdown>{`
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
`}</Markdown>
    ))
    .add('Quotes', () => (
      <Markdown>{`> this is quoted
> this is _italics_ inside of a quote. This is *bold* inside of a quote.
> outside code: \`This is an inline block of code in a quote\` outside again
> \`\`\`
multi
line
code in quote
\`\`\`
`}</Markdown>
    ))
    .add('Code block', () => (
      <Markdown>{`
        \`\`\`this is a code block\`\`\`
\`\`\`
this is a code block that starts with a newline\`\`\`
\`\`\`
this is a code block that starts with a newline and ends with a newline
\`\`\`
\`\`\`

this is a code block with two newline above\`\`\`
`}</Markdown>
    ))
    .add('Blank lines', () => (
      <Markdown>{`

        hello


        world


      `}</Markdown>
    ))
}

export default load
