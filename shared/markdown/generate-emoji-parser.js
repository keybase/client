// @flow
import fs from 'fs'
import path from 'path'
import peg from 'pegjs'
import emojiData from 'emoji-datasource'
import tlds from 'tlds'

/**
 * Note on above: importing a non-transpiled module that uses modern JS features
 * (e.g. `import`) will break this! babel-node does not transpile imports from
 * node_modules/ by default. See this thread for more:
 * https://github.com/babel/babel/issues/7566
 */

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
  const emojiIndexByName = {}
  const emojiLiterals = []
  const emojiCharacters = new Set()
  function addEmojiLiteral(unified, name, skinTone) {
    const chars = unified.split('-').map(c => String.fromCodePoint(parseInt(c, 16)))
    const literals = chars.map(c => UTF162JSON(c)).join('')

    const fullName = `:${name}:` + (skinTone ? `:skin-tone-${skinTone}:` : '')
    const char = chars.join('')
    if (!emojiIndexByChar[char]) {
      // Don’t overwrite existing emoji in the index.
      emojiIndexByChar[char] = fullName
    }
    if (!emojiIndexByName[fullName]) {
      // For display. Only adds the first supplied code points,
      // so make sure that is the fully qualified one
      emojiIndexByName[fullName] = char
    }
    emojiLiterals.push(literals)
    chars.forEach(c => emojiCharacters.add(c))
  }

  emojiData.forEach(emoji => {
    if (emoji.skin_variations) {
      Object.keys(emoji.skin_variations).forEach((k, idx) =>
        addEmojiLiteral(emoji.skin_variations[k].unified, emoji.short_name, idx + 1)
      )
    }
    addEmojiLiteral(emoji.unified, emoji.short_name)
    if (emoji.non_qualified) {
      addEmojiLiteral(emoji.non_qualified, emoji.short_name)
    }
  })

  // Add aliases after all default short names have been added. Otherwise, :man-woman-boy:’s
  // :family: alias will take the place of the default :family: emoji, and they are not the same.
  emojiData.forEach(emoji => {
    const short_names = emoji.short_names
    short_names.shift() // remove the first, we already have it
    short_names.forEach(name => addEmojiLiteral(emoji.unified, name))
    if (emoji.non_qualified) {
      short_names.forEach(name => addEmojiLiteral(emoji.non_qualified, name))
    }
  })

  emojiLiterals.sort((a, b) => b.length - a.length)

  return {emojiIndexByChar, emojiIndexByName, emojiLiterals, emojiCharacters}
}

function buildParser() {
  const {emojiIndexByChar, emojiIndexByName, emojiLiterals, emojiCharacters} = genEmojiData()
  const emojiRegex = `/${emojiLiterals.join('|')}/g`
  const emojiCharacterClass = `${Array.from(emojiCharacters).join('')}`

  const sourcePath = process.argv[2]
  const source = fs.readFileSync(sourcePath, {encoding: 'utf8'})

  const generatedSource = source.replace('__EMOJI_CHARACTERS__', emojiCharacterClass).replace(
    /__INLINE_RULE__<([^>,]*)\s*,\s*([^>,]*)>/g,
    `$1Start
 = !CodeBlock $2 (InlineStartCommon / ((EscapedChar / SpecialChar) $1Start?))

$1Cont
 = $2 InlineCont

$1
 = ($1Start ((InlineDelimiter+ $1Start) / $1Cont)*)
`
  )

  const linkExp = /^(?:(http(s)?):\/\/)?(([a-z0-9-]+\.)+([a-z]{2,63})|(\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b))(((\/)|(\?))[a-z0-9.()\-_~:?#[\]@!$&'%*+,;=]*)*$/i
  const tldPuncExp = /^(?:(http(s)?):\/\/)?(([a-z0-9-]+\.)+([a-z]{2,63})|(\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b))([)\].,;:"']+$)/i
  const plaintextExp = /^([A-Za-z0-9!?=+$%^&[\],'"\s]|\.\B)*$/
  const phoneExp = /[0-9]{3}\s?[0-9]{3}\s?[0-9]{4}/

  // the regexes here get recompiled on every parse if we put it in the initializer, so we force it to run at import time.
  //
  // NOTE: Don't use import here ever. We can't mix import and module.exports. You can use require (or inject the output using stringify)
  //
  // $FlowIssue Unclear why flow isn't accepting String.raw here
  const prependJS = String.raw`
    const tldExp = new RegExp(/\.(${tlds.join('|')})\b/)
    const ipExp = new RegExp(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)
    const linkExp = ${linkExp}
    const tldPuncExp = ${tldPuncExp}
    const emojiExp = ${emojiRegex}
    const emojiIndexByChar = ${JSON.stringify(emojiIndexByChar)}
    const emojiIndexByName = ${JSON.stringify(emojiIndexByName)}
  `

  // $FlowIssue Unclear why flow isn't accepting String.raw here
  const appendJS = String.raw`
    module.exports.emojiIndexByChar = emojiIndexByChar
    module.exports.emojiIndexByName = emojiIndexByName

    // quick check to avoid markdown parsing overhead
    // only chars, numbers, whitespace, some common punctuation and periods
    // that end sentences (not domains)
    const plaintextExp = ${plaintextExp}

    // phone numbers in 123 456 7890 format are plaintext, so test
    // for those explicitly and send to peg
    const phoneExp = ${phoneExp}

    module.exports.isPlainText = function isPlainText(markdown) {
      return markdown && (markdown.match(plaintextExp) && !markdown.match(phoneExp)) ? markdown.trim() : null
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

function buildEmojiFile() {
  const p = path.join(__dirname, '..', 'markdown', 'emoji.js')
  const {emojiLiterals, emojiIndexByName} = genEmojiData()
  const data = `// @noflow
export const emojiRegex = /^(${emojiLiterals.join('|')}|${Object.keys(emojiIndexByName).join('|')})/`
  fs.writeFileSync(p, data, {encoding: 'utf8'})
}

// TODO deprecate this one
buildParser()
buildEmojiFile()
