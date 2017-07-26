// @flow
/* eslint-env jest */
import parser, {isPlainText} from '../parser'

function check(md) {
  const ast = parser.parse(md)
  expect(ast).toMatchSnapshot()

  const plainText = isPlainText(md)
  if (plainText) {
    const astIsEmpty = ast.children.length === 0
    const astIsOnlyText = ast.children.every(
      child =>
        child.type === 'text-block' &&
        (child.children.length === 0 ||
          (child.children.length === 1 && typeof child.children[0] === 'string'))
    )
    expect(astIsEmpty || astIsOnlyText).toBe(true)

    const text = ast.children.map(child => child.children[0]).join('\n')
    expect(text).toBe(plainText)
  }
}

describe('Markdown parser', () => {
  it('parses an empty line correctly', () => {
    check('')
  })

  it('parses a single delimiter correctly', () => {
    check('.')
  })

  it('parses a line with just whitespace correctly', () => {
    check('    ')
  })

  it('eats multiple empty lines at start', () => {
    check('    \n\n\n\nstart')
  })

  it('eats multiple empty lines at end', () => {
    check('end\n\n\n\n   ')
  })

  it('preserves multiple empty lines', () => {
    check('be\n\n   \n\ntween')
  })

  it('parses plaintext correctly', () => {
    check("hello, there! how are you? this shouldn't be markdown.")
  })

  it('parses multiple adjacent emoji correctly', () => {
    check(':ok_hand::skin-tone-2::smile::wink:')
  })

  it('parses invalid bold correctly', () => {
    check('*not bold**')
  })

  it('parses formatting adjacent to punctuation', () => {
    check('thisis(*bold*) and(_italic_) and,~striked~! (*woot*) another.*test*.case')
  })

  it('parses invalid emoji fragments correctly', () => {
    check('one::\n::two\n:three?::\n::four:\n::')
  })

  it('parses numbers and some symbols emoji', () => {
    check(':+1: :100:')
  })

  it('parses kitchen sink demo correctly', () => {
    check(
      'I think we should try to use `if else` statements ```if (var == "foo")\n  echo "foo";\nelse echo "bar";``` How about *bold* and _italic?_ nice.\n Now youre thinking with ~portals~ crypto.\n how about ~_*bold and italic and strike through?*_~ - now - _*some bold* and just italic_'
    )
  })

  it('parses escaped chars correctly', () => {
    check('I \\*should\\* see asterisks')
  })

  it('parses special characters within words correctly', () => {
    check('not*bolded* *also*notbolded')
  })

  it('parses native emoji correctly', () => {
    check('hello there 🌸😎👍🏿!')
  })
  it('parses native zwj emoji correctly', () => {
    check('👩‍❤️‍💋‍👩 👩‍👩‍👧‍👧!')
  })
  it('parses quote blocks correctly', () => {
    check(`
> this is quoted
> this is _italics_ inside of a quote. This is *bold* inside of a quote.
> outside code: \`This is an inline block of code in a quote\` outside again
> \`\`\`
multi
line
code in quote
\`\`\`
`)
  })
  it('parses more code blocks correctly', () => {
    check(`
        \`\`\`this is a code block\`\`\`
\`\`\`
this is a code block that starts with a newline\`\`\`
\`\`\`
this is a code block that starts with a newline and ends with a newline
\`\`\`
\`\`\`

this is a code block with two newline above\`\`\`
`)
  })
  it('parses incomplete code blocks correctly', () => {
    for (let i = 1; i <= 7; i++) {
      check('`'.repeat(i))
    }
  })
  it('parses urls correctly', () => {
    check(`
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
`)
  })
})
