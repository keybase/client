// @noflow
/* eslint-env jest */
import parser, {emojiIndexByName, isPlainText} from '../parser'
import emojiData from 'emoji-datasource'

function check(md, options) {
  const ast = parser.parse(md, options)
  // $FlowIssue
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

  it('parses inline bold correctly', () => {
    check('*bold**')
  })

  it('parses formatting adjacent to punctuation', () => {
    check('thisis(*bold*) and(_italic_) and,~striked~! (*woot*) another.*test*.case')
  })

  const isValidMention = (s: string) => s.startsWith('valid')

  it('parses punctuation then formatting', () => {
    check('(*bold*')
    check('(_italic_')
    check('(@validmarco', {isValidMention})
  })

  it('parses double bold as text', () => {
    check('**hmm**')
  })

  it('parses double bold with punctuation as text', () => {
    check('*(*hmm**')
  })

  it('parses double bold with splitting punctuation as single bold', () => {
    check('*(*hmm*)*')
  })

  it('parses invalid emoji fragments correctly', () => {
    check('one::\n::two\n:three?::\n::four:\n::')
  })

  it('parses numbers and some symbols emoji', () => {
    check(':+1: :100:')
  })

  it('inline code', () => {
    check('I think we should try to use `if else` statements')
  })

  it('inline code not multiline', () => {
    check('`foo\nbar`')
  })

  it('parses kitchen sink demo correctly', () => {
    check(
      'I think we should try to use `if else` statements ```if (var == "foo")\n  echo "foo";\nelse echo "bar";``` How about *bold* and _italic?_ nice.\n Now you are thinking with ~portals~ crypto.\n how about ~_*bold and italic and strike through?*_~ - now - _*some bold* and just italic_'
    )
  })

  it('Messed up', () => {
    check('```if (var == "foo")\n  echo "foo";\nelse echo "bar";``')
    check('I think I *missed something**')
  })

  it('parses escaped chars correctly', () => {
    check('I \\*should\\* see asterisks')
  })

  it('parses chars in the middle of words correctly', () => {
    check('isnot*bolded* *also*isnotbolded')
  })

  it('parses emoji aliases correctly', () => {
    const hankey = emojiIndexByName[':hankey:']
    ;['poop', 'shit'].forEach(name => {
      expect(emojiIndexByName[`:${name}:`]).toBe(hankey)
    })
  })
  it('parses native emoji correctly', () => {
    check('hello there 🌸😎👍🏿!')
  })
  it('parses native zwj emoji correctly', () => {
    check('👩‍❤️‍💋‍👩 👩‍👩‍👧‍👧!')
    check('👩‍❤️‍💋‍👨 👨‍👧 👨‍👦 👨‍👩‍👧‍👦 👨‍👨‍👧‍👧 👩‍👩‍👧‍👦 👩‍❤️‍👩')
  })
  it('parses qualified and non-qualified emoji identically', () => {
    const codePointsToChar = series => {
      const codePoints = series.split('-').map(codePoint => parseInt(codePoint, 16))
      return String.fromCodePoint(...codePoints)
    }

    emojiData.forEach(emoji => {
      const emojiName = `:${emoji.short_name}:`
      // make sure we always map to unified code points
      expect(emojiIndexByName[emojiName]).toBe(codePointsToChar(emoji.unified))
      if (emoji.unified && emoji.non_qualified) {
        const expectedAst = {
          children: [
            {
              children: [
                {
                  children: [emojiName],
                  type: 'native-emoji',
                },
              ],
              type: 'text-block',
            },
          ],
          type: 'markup',
        }
        // check that both unified and non_qualified parse to same thing
        ;[emoji.unified, emoji.non_qualified].map(codePoints => {
          const emoji = codePointsToChar(codePoints)
          const ast = parser.parse(emoji)
          expect(ast).toEqual(expectedAst)
        })
      }
    })
  })
  it('parses phone numbers correctly', () => {
    // Should succeed
    check('(123) 456-7890')
    check('(123) 456 7890')
    check('(123)456-7890')
    check('(123)456 7890')
    check('123-456-7890')
    check('123-456 7890')
    check('123 456-7890')
    check('123 456 7890')
    // Should fail
    check('123 456 78901')
    check('(123) 456 78901')
    check('(123) 456 7890a')
    check('12345678901')
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
    nytimes.json
    keybase.diamond
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
    keybase.diamonds
    10.0.0.24
    google.com
    keybase.io/a/user/lookup?one=1&two=2
    keybase.io/a/user/path_with_underscore
    keybase.io?blah=true
    keybase.io/~user/cool
    http://keybase.io/blah/../up-one/index.html
    keybase.io/)(,)?=56,78,910@123
    keybase.io/().@:hello*
  These should have the trailing punctuation outside the link:
    amazon.co.uk.
    keybase.io,
    keybase.io.
    keybase.io?
    keybase.io)
    *http://keybase.io/*.
    *http://keybase.io/~_*
  These should have only the matching brackets removed from them:
    (https://en.wikipedia.org/wiki/Redshirt_(character))
    ([(https://en.wikipedia.org/wiki/Redshirt_(character))])
    ([keybase.io])
`)
  })

  it('does not parses mentions without isValidMention', () => {
    check('hello there @marco')
  })
  it('parses mentions correctly', () => {
    check('hello there @marco @validmarco', {isValidMention})
  })

  const allowAllMentions = (s: string) => true

  it('parses mentions with underscores correctly', () => {
    check('hello there @ryan_singer @m_ @dan_t @a_b_c', {isValidMention: allowAllMentions})
    // This gets parsed as a mention for @invalid_ followed by the
    // text _name_.
    check('hello there @invalid__name_', {isValidMention: allowAllMentions})
  })
  it('ignores short/long mentions', () => {
    check('hello there @a@keybase @0123456789abcdefg@keybase', {isValidMention: allowAllMentions})
  })
  it('parses formatted mentions', () => {
    check('~@validmarco~', {isValidMention})
    check('*@validmarco*', {isValidMention})
    // The trailing underscore is parsed as part of the mention.
    check('_@validmarco_', {isValidMention})
    // Even if we disallow validmarco_ as a valid mention, prefixes
    // won't be tried, and so the whole thing renders as regular text.
    check('_@validmarco_', {isValidMention: (s: string) => s === 'validmarco'})
  })
  it('ignores mentions in code', () => {
    check('@validmarco `@validmarco` `some inline code @validmarco`', {isValidMention})
    check('@validmarco ```@validmarco``` ```this is a code block @validmarco```', {isValidMention})
  })

  const channelNameToConvID = (s: string) => s.startsWith('valid') && 'fakeConvID-' + s

  it('parses channels correctly', () => {
    check('hello there #some_channel #valid_channel', {channelNameToConvID})
    // Too short.
    check('hello there #', {channelNameToConvID: (s: string) => 'fakeConvID-' + s})
    // Too long.
    check('hello there #valid6789012345678901', {channelNameToConvID})
  })
  it('parses formatted channels', () => {
    check('hello there ~#valid_channel~', {channelNameToConvID})
    check('hello there *#valid_channel*', {channelNameToConvID})
    // The trailing underscore is parsed as part of the channel.
    check('hello there _#valid_channel_', {channelNameToConvID})
    // Even if we disallow valid_channel_ as a valid channel, prefixes
    // won't be tried, and so the whole thing renders as regular text.
    check('hello there _#valid_channel_', {
      channelNameToConvID: (s: string) => s === 'valid_channel' && 'fakeConvID-valid_channel',
    })
  })
})
