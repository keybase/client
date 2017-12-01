// @flow
import fs from 'fs'
import path from 'path'
import peg from 'pegjs'
import emojiData from 'emoji-datasource'
import invert from 'lodash/invert'
import tlds from 'tlds'

// from https://github.com/twitter/twemoji/blob/gh-pages/twemoji-generator.js
function UTF162JSON(text) {
  let r = []
  for (let i = 0; i < text.length; i++) {
    r.push('\\u' + ('000' + text.charCodeAt(i).toString(16)).slice(-4))
  }
  return r.join('')
}

function genEmojiData() {
  const emojiIndexByChar = {}
  const emojiLiterals = []
  const emojiCharacters = new Set()
  function addEmojiLiteral(unified, name, skinTone) {
    const chars = unified.split('-').map(c => String.fromCodePoint(parseInt(c, 16)))
    const literals = chars.map(c => UTF162JSON(c)).join('')

    emojiIndexByChar[chars.join('')] = `:${name}:` + (skinTone ? `:skin-tone-${skinTone}:` : '')
    emojiLiterals.push(literals)
    chars.forEach(c => emojiCharacters.add(c))
  }

  emojiData.forEach(emoji => {
    if (emoji.skin_variations) {
      Object.keys(emoji.skin_variations).forEach((k, idx) =>
        addEmojiLiteral(emoji.skin_variations[k].unified, emoji.short_name, idx + 1)
      )
    }
    emoji.variations.forEach(v => addEmojiLiteral(v, emoji.short_name))
    addEmojiLiteral(emoji.unified, emoji.short_name)
  })

  emojiLiterals.sort((a, b) => b.length - a.length)

  return {emojiIndexByChar, emojiLiterals, emojiCharacters}
}

function buildParser() {
  const {emojiIndexByChar, emojiLiterals, emojiCharacters} = genEmojiData()
  const emojiRegex = `/${emojiLiterals.join('|')}/g`
  const emojiCharacterClass = `${Array.from(emojiCharacters).join('')}`

  const sourcePath = process.argv[2]
  const source = fs.readFileSync(sourcePath, {encoding: 'utf8'})

  const generatedSource = source.replace('__EMOJI_CHARACTERS__', emojiCharacterClass).replace(
    /__INLINE_RULE__<([^>,]*)\s*,\s*([^>,]*)>/g,
    `$1Start
 = $2 (InlineCode / Italic / Bold / Link / Mention / Strike / (!CodeBlock (Text / Emoji / NativeEmoji / ((EscapedChar / SpecialChar) $1Start?))))

$1Cont
 = $2 InlineCont

$1
 = ($1Start ((InlineDelimiter+ $1Start) / $1Cont)*)
`
  )

  const linkExp = /^(?:(http(s)?):\/\/)?(([a-z0-9-]+\.)+([a-z]{2,63})|(\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b))(((\/)|(\?))[a-z0-9.()\-_~:?#[\]@!$&'%*+,;=]*)*$/i
  const tldPuncExp = /^(?:(http(s)?):\/\/)?(([a-z0-9-]+\.)+([a-z]{2,63})|(\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b))([)\].,;:"']+$)/i
  const tldExp = /^(?:(http(s)?):\/\/)?([a-z0-9-]+\.)+([a-z]{2,63})/i
  const plaintextExp = /^([A-Za-z0-9!?=+#$%^&()[\],'"\s]|\.\B)*$/

  // the regexes here get recompiled on every parse if we put it in the initializer, so we force it to run at import time.
  //
  // NOTE: Don't use import here ever. We can't mix import and module.exports. You can use require (or inject the output using stringify)
  //
  // $FlowIssue Unclear why flow isn't accepting String.raw here
  const prependJS = String.raw`
    const tlds = ${JSON.stringify(tlds)}
    const linkExp = ${linkExp}
    const tldPuncExp = ${tldPuncExp}
    const tldExp = ${tldExp}
    const emojiExp = ${emojiRegex}
    const emojiIndexByChar = ${JSON.stringify(emojiIndexByChar)}
    const emojiIndexByName = ${JSON.stringify(invert(emojiIndexByChar))}
  `

  // $FlowIssue Unclear why flow isn't accepting String.raw here
  const appendJS = String.raw`
    module.exports.emojiIndexByChar = emojiIndexByChar
    module.exports.emojiIndexByName = emojiIndexByName

    // quick check to avoid markdown parsing overhead
    // only chars, numbers, whitespace, some common punctuation and periods
    // that end sentences (not domains)
    const plaintextExp = ${plaintextExp}
    module.exports.isPlainText = function isPlainText(markdown) {
      return markdown && markdown.match(plaintextExp) ? markdown.trim() : null
    }
  `

  const parserJS = peg.generate(generatedSource, {output: 'source', format: 'commonjs'})

  // FIXME: PEG.js splits emoji UTF-16 surrogate pairs up when generating array
  // of expected characters (which is only used for error message output).
  // Something in our react-native build chain then picks up these invalid
  // unicode literals (e.g. \uD83C) and changes them to \u0NaN, resulting in
  // syntax errors at JS parse time. We strip out this debug information to
  // avoid provoking this error.
  const strippedParserJS = parserJS.replace(
    /peg\$classExpectation\((.+)\),/g,
    `peg$otherExpectation("stripped character class"),`
  )

  const fullParserJS = prependJS + strippedParserJS + appendJS

  const parserPath = path.format({...path.parse(sourcePath), base: undefined, ext: '.js'})
  fs.writeFileSync(parserPath, fullParserJS, {encoding: 'utf8'})
}

buildParser()
