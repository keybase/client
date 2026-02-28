import {default as fs, promises as fsp} from 'fs'
import path from 'path'
import emojiData from 'emoji-datasource-apple'
import escapeRegExp from 'lodash/escapeRegExp'
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
function UTF162JSON(text: string) {
  const r: Array<string> = []
  for (let i = 0; i < text.length; i++) {
    r.push('\\u' + ('000' + text.charCodeAt(i).toString(16)).slice(-4))
  }
  return r.join('')
}

function genEmojiData() {
  const emojiIndexByChar: {[key: string]: string} = {}
  const emojiIndexByName: {[key: string]: string} = {}
  const emojiLiterals: Array<string> = []
  function addEmojiLiteral(unified: string, name: string, skinTone?: number) {
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
      Object.keys(emoji.skin_variations).forEach((_k, idx) => {
        const k = _k as keyof typeof emoji.skin_variations
        // + 2 because idx starts at 0, and skin-tone-1 is not a thing
        addEmojiLiteral(emoji.skin_variations?.[k]?.unified ?? '', emoji.short_name, idx + 2)
      })
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

const getSpriteSheetSize = async () => {
  const sheet = path.join(__dirname, '../../node_modules/emoji-datasource-apple/img/apple/sheets/64.png')
  // Read the first 24 bytes of the PNG file
  const buffer = await fsp.readFile(sheet, {encoding: null, flag: 'r'})
  const isPng = buffer.toString('utf-8', 1, 4) === 'PNG'
  if (!isPng) {
    throw new Error('bad sheet')
  }

  const singleWidth = 64 + 2 // 64px + 2px padding
  // Extract width and height from the PNG header
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  return {sheight: height / singleWidth, swidth: width / singleWidth}
}

async function buildEmojiFile() {
  const p = path.join(__dirname, 'emoji-gen.tsx')

  const {swidth, sheight} = await getSpriteSheetSize()
  const {emojiIndexByName, emojiIndexByChar} = genEmojiData()
  const regIndex = Object.keys(emojiIndexByName)
    .map((s: string) => escapeRegExp(s).replace(/\\/g, '\\\\'))
    .join('|')
  const data = `/* eslint-disable */
import emojiRegexNew from 'emoji-regex'
const emojiRegex2 = emojiRegexNew()
export const spriteSheetWidth = ${swidth}
export const spriteSheetHeight = ${sheight}
export const emojiRegex = new RegExp(\`^(\${emojiRegex2.source}|${regIndex})\`)
export const emojiIndexByName: {[key: string]: string} = JSON.parse(\`${JSON.stringify(
    emojiIndexByName,
    null,
    2
  )}\`)
export const emojiIndexByChar: {[key: string]: string}  = JSON.parse(\`${JSON.stringify(
    emojiIndexByChar,
    null,
    2
  )}\`)
export const commonTlds = ${JSON.stringify(commonTlds)}
`
  const options = await prettier.resolveConfig(p)
  const formatted = await prettier.format(data, {
    ...options,
    parser: 'typescript',
  })
  fs.writeFileSync(p, formatted, {encoding: 'utf8'})
}

buildEmojiFile()
  .then(() => {})
  .catch((e: unknown) => {
    throw e
  })
