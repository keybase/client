// @flow
import fs from 'fs'
import path from 'path'
import peg from 'pegjs'
import emojiData from 'emoji-datasource'

// from https://github.com/twitter/twemoji/blob/gh-pages/twemoji-generator.js
function UTF162JSON (text) {
  let r = []
  for (let i = 0; i < text.length; i++) {
    r.push('\\u' + ('000' + text.charCodeAt(i).toString(16)).slice(-4))
  }
  return r.join('')
}

function genEmojiData () {
  const emojiIndex = {}
  const emojiLiterals = []
  const emojiCharacters = new Set()
  function addEmojiLiteral (unified, name, skinTone) {
    const chars = unified.split('-').map(c => String.fromCodePoint(parseInt(c, 16)))
    const literals = chars.map(c => UTF162JSON(c)).join('')

    emojiIndex[chars.join('')] = `:${name}:` + (skinTone ? `:skin-tone-${skinTone}:` : '')
    emojiLiterals.push(literals)
    chars.forEach(c => emojiCharacters.add(c))
  }

  emojiData.forEach(emoji => {
    if (emoji.skin_variations) {
      Object.keys(emoji.skin_variations).forEach((v, idx) => addEmojiLiteral(v, emoji.short_name, idx + 1))
    }
    emoji.variations.forEach(v => addEmojiLiteral(v, emoji.short_name))
    addEmojiLiteral(emoji.unified, emoji.short_name)
  })

  emojiLiterals.sort((a, b) => b.length - a.length)

  return {emojiIndex, emojiLiterals, emojiCharacters}
}

function buildParser () {
  const {emojiIndex, emojiLiterals, emojiCharacters} = genEmojiData()
  const emojiRegex = `/${emojiLiterals.join('|')}/g`
  const emojiCharacterClass = `${Array.from(emojiCharacters).join('')}`

  const sourcePath = process.argv[2]
  const source = fs.readFileSync(sourcePath, {encoding: 'utf8'})

  const generatedSource = source
    .replace('__EMOJI_CHARACTERS__', emojiCharacterClass)
    .replace(/__INLINE_MACRO__<([^>]*)>/g, '($1 InlineStart ((WhiteSpace+ $1 InlineStart) / ($1 InlineCont))*)')

  // the regexes here get recompiled on every parse if we put it in the initializer, so we force it to run at import time.
  // $FlowIssue flow doesn't accept this tagged template literal
  const prependJS = String.raw`
    const linkExp = /^(:?\/\/)?(?:www\.)?[-a-zA-Z0-9@%._\+~#=]{2,256}(?::[0-9]{1,6})?\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)\b/i
    const dotDotExp = /[^/]\.\.[^/]/
    const emojiExp = ${emojiRegex}
    const emojiIndex = ${JSON.stringify(emojiIndex)}
  `
  const parserJS = peg.generate(generatedSource, {output: 'source', format: 'commonjs'})
  const fullParserJS = prependJS + parserJS

  const parserPath = path.format({...path.parse(sourcePath), base: undefined, ext: '.js'})
  fs.writeFileSync(parserPath, fullParserJS, {encoding: 'utf8'})
}

buildParser()
