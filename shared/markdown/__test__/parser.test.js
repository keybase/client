// @flow
/* eslint-env jest */
import parser from '../parser'

describe('Markdown parser', () => {
  it('parses an empty line correctly', () => {
    const ast = parser.parse('')
    expect(ast).toMatchSnapshot()
  })

  it('parses a single delimiter correctly', () => {
    const ast = parser.parse('.')
    expect(ast).toMatchSnapshot()
  })

  it('parses a line with just whitespace correctly', () => {
    const ast = parser.parse('    ')
    expect(ast).toMatchSnapshot()
  })

  it('eats multiple empty lines at start', () => {
    const ast = parser.parse('    \n\n\n\nstart')
    expect(ast).toMatchSnapshot()
  })

  it('eats multiple empty lines at end', () => {
    const ast = parser.parse('end\n\n\n\n   ')
    expect(ast).toMatchSnapshot()
  })

  it('preserves multiple empty lines', () => {
    const ast = parser.parse('be\n\n   \n\ntween')
    expect(ast).toMatchSnapshot()
  })

  it('parses multiple adjacent emoji correctly', () => {
    const ast = parser.parse(':ok_hand::skin-tone-2::smile::wink:')
    expect(ast).toMatchSnapshot()
  })

  it('parses invalid bold correctly', () => {
    const ast = parser.parse('*not bold**')
    expect(ast).toMatchSnapshot()
  })

  it('parses formatting adjacent to punctuation', () => {
    const ast = parser.parse('thisis(*bold*) and(_italic_) and,~striked~! (*woot*) another.*test*.case')
    expect(ast).toMatchSnapshot()
  })

  it('parses invalid emoji fragments correctly', () => {
    const ast = parser.parse('one::\n::two\n:three?::\n::four:\n::')
    expect(ast).toMatchSnapshot()
  })

  it('parses numbers and some symbols emoji', () => {
    const ast = parser.parse(':+1: :100:')
    expect(ast).toMatchSnapshot()
  })

  it('parses kitchen sink demo correctly', () => {
    const ast = parser.parse(
      'I think we should try to use `if else` statements ```if (var == "foo")\n  echo "foo";\nelse echo "bar";``` How about *bold* and _italic?_ nice.\n Now youre thinking with ~portals~ crypto.\n how about ~_*bold and italic and strike through?*_~ - now - _*some bold* and just italic_'
    )
    expect(ast).toMatchSnapshot()
  })

  it('parses escaped chars correctly', () => {
    const ast = parser.parse('I \\*should\\* see asterisks')
    expect(ast).toMatchSnapshot()
  })

  it('parses special characters within words correctly', () => {
    const ast = parser.parse('not*bolded* *also*notbolded')
    expect(ast).toMatchSnapshot()
  })

  it('parses native emoji correctly', () => {
    const ast = parser.parse('hello there 🌸😎👍🏿!')
    expect(ast).toMatchSnapshot()
  })
  it('parses native zwj emoji correctly', () => {
    const ast = parser.parse('👩‍❤️‍💋‍👩 👩‍👩‍👧‍👧!')
    expect(ast).toMatchSnapshot()
  })
  it('parses quote blocks correctly', () => {
    const ast = parser.parse(`
> this is quoted
> this is _italics_ inside of a quote. This is *bold* inside of a quote.
> outside code: \`This is an inline block of code in a quote\` outside again
> \`\`\`
multi
line
code in quote
\`\`\`
`)
    expect(ast).toMatchSnapshot()
  })
  it('parses more code blocks correctly', () => {
    const ast = parser.parse(`
        \`\`\`this is a code block\`\`\`
\`\`\`
this is a code block that starts with a newline\`\`\`
\`\`\`
this is a code block that starts with a newline and ends with a newline
\`\`\`
\`\`\`

this is a code block with two newline above\`\`\`
`)
    expect(ast).toMatchSnapshot()
  })
  it('parses incomplete code blocks correctly', () => {
    for (let i = 1; i <= 7; i++) {
      const ast = parser.parse('`'.repeat(i))
      expect(ast).toMatchSnapshot()
    }
  })
  it('parses urls correctly', () => {
    const ast = parser.parse(`
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
    expect(ast).toMatchSnapshot()
  })
})
