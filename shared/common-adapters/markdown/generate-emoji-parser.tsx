import fs from 'fs'
import path from 'path'
// TODO: is there something better to do that ignore this?
// @ts-ignore
import emojiData from 'emoji-datasource'
// MUST be lodash for node to work simply
// eslint-disable-next-line
import {escapeRegExp} from 'lodash'
import prettier from 'prettier'

const commonTlds = [
  'com',
  'org',
  'edu',
  'gov',
  'uk',
  'net',
  'ca',
  'de',
  'jp',
  'fr',
  'au',
  'us',
  'ru',
  'ch',
  'it',
  'nl',
  'se',
  'no',
  'es',
  'io',
  'tv',
]

/**
 * Note on above: importing a non-transpiled module that uses modern JS features
 * (e.g. `import`) will break this! babel-node does not transpile imports from
 * node_modules/ by default. See this thread for more:
 * https://github.com/babel/babel/issues/7566
 */

// from https://github.com/twitter/twemoji/blob/gh-pages/twemoji-generator.js
function UTF162JSON(text) {
  let r: Array<string> = []
  for (let i = 0; i < text.length; i++) {
    r.push('\\u' + ('000' + text.charCodeAt(i).toString(16)).slice(-4))
  }
  return r.join('')
}

function genEmojiData() {
  const emojiIndexByChar = {}
  const emojiIndexByName = {}
  const emojiLiterals: Array<string> = []
  function addEmojiLiteral(unified, name, skinTone?) {
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
  }

  emojiData.forEach(emoji => {
    if (emoji.skin_variations) {
      Object.keys(emoji.skin_variations).forEach((k, idx) =>
        // + 2 because idx starts at 0, and skin-tone-1 is not a thing
        addEmojiLiteral(emoji.skin_variations[k].unified, emoji.short_name, idx + 2)
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

  return {emojiIndexByChar, emojiIndexByName, emojiLiterals}
}

function buildEmojiFile() {
  const p = path.join(__dirname, 'emoji-gen.tsx')
  const {emojiLiterals, emojiIndexByName, emojiIndexByChar} = genEmojiData()
  const regLiterals = emojiLiterals.map((s: string) => escapeRegExp(s).replace(/\\/g, '\\')).join('|')
  const regIndex = Object.keys(emojiIndexByName)
    .map((s: string) => escapeRegExp(s).replace(/\\/g, '\\\\'))
    .join('|')
  const data = `/* eslint-disable */
export const emojiRegex = new RegExp(\`^(${regLiterals}|${regIndex})\`)
export const emojiIndexByName = JSON.parse(\`${JSON.stringify(emojiIndexByName, null, 2)}\`)
export const emojiIndexByChar = JSON.parse(\`${JSON.stringify(emojiIndexByChar, null, 2)}\`)
export const commonTlds = ${JSON.stringify(commonTlds)}
`

  const formatted = prettier.format(data, {
    ...prettier.resolveConfig.sync(p),
    parser: 'typescript',
  })
  fs.writeFileSync(p, formatted, {encoding: 'utf8'})
}

buildEmojiFile()
