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
    okay.json
    okay.png
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
    wikipedia.org/hello_(world)_(okay)
    json.org/image.json
    trailing.com/trail#!t
    commas.net/a,b,c,d
    https://www.google.com/search?q=full+circle+bar&oq=full+circle+bar&aqs=chrome..69i57j0j69i60l3j69i61.2262j0j7&sourceid=chrome&ie=UTF-8
    https://github.com/keybase/client/compare/master...miles/team-test
    https://www.google.com/maps/place/207+Union+Tpke,+Hollis+Hills,+NY+11364/@40.7296274,-73.8891088,13z/data=!4m21!1m15!4m14!1m6!1m2!1s0x89c25944285c8d37:0xec514da3903a76f8!2s99+Norman+Avenue,+Brooklyn,+NY+11222,+USA!2m2!1d-73.9512991!2d40.7257587!1m6!1m2!1s0x89c2619a6e18c11f:0xa90d5492c8d767a0!2s207+Union+Tpke,+Hollis+Hills,+NY+11364!2m2!1d-73.7635942!2d40.7331327!3m4!1s0x89c2619a6e18c11f:0xa90d5492c8d767a0!8m2!3d40.7331327!4d-73.7635942
    https://www.google.com/maps/@37.811065,-122.4770798,3a,75y,346.55h,93.26t/data=!3m8!1e1!3m6!1s-cLDS636PtKU%2FVTx5N5EPNEI%2FAAAAAAAAChw%2FrgTinSxtV2kMWucPvTg17jfwRFq9NQeYACJkC!2e4!3e11!6s%2F%2Flh6.googleusercontent.com%2F-cLDS636PtKU%2FVTx5N5EPNEI%2FAAAAAAAAChw%2FrgTinSxtV2kMWucPvTg17jfwRFq9NQeYACJkC%2Fw203-h100-k-no-pi-0-ya143.44029-ro0-fo100%2F!7i10240!8i5120
    https://groups.google.com/forum/#!topic/golang-dev/1ZV7mIj_Du8
    https://en.wikipedia.org/wiki/Redshirt_(character)
    https://t.co
    https://g.co
    trailing.com/trail...t
    trailing.com/trail..t
    trailing.com/trail.t
  These should have the trailing punctuation outside the link:
    trailing.com/trail...
    trailing.com/trail..
    trailing.com/trail.
    commas.net/a,b,c,d,
    trailing.com/trail#!
    wikipedia.org/hello_(world
    wikipedia.org/hello_(world)_(okay
    (wikipedia.org/hello_(world)_(okay
    (wikipedia.org/hello_(world)_(okay)
    (wikipedia.org/hello_(world)_(okay))
    amazon.co.uk.
    keybase.io,
    keybase.io.
    keybase.io?
    *http://keybase.io/*.
    *http://keybase.io/~_*
`)
  })
})
