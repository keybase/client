import {Directory, File, Paths} from 'expo-file-system'
import logger from '@/logger'
import {makeUUID} from '@/util/uuid'

// Chat's limit on a text message, in UTF-8 bytes: TextMessageMaxLength in go/chat/msgchecker,
// which measures len() of the Go string. Shares only ever go to chat-type conversations, so the
// larger dev-topic limit never applies.
export const textMessageMaxBytes = 10000

const utf8Bytes = (cp: number) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4)

export const fitsInTextMessage = (text: string) => {
  // every UTF-16 unit is at least one byte, and at most three
  if (text.length > textMessageMaxBytes) return false
  if (text.length * 3 <= textMessageMaxBytes) return true
  let bytes = 0
  for (const ch of text) {
    bytes += utf8Bytes(ch.codePointAt(0) ?? 0)
  }
  return bytes <= textMessageMaxBytes
}

// How shared text joins a draft: on its own line after it.
export const appendLine = (text: string, s: string) =>
  !text ? s : !s ? text : text.endsWith('\n') ? `${text}${s}` : `${text}\n${s}`

// The one rule for where shared text goes: after the draft when chat's message limit leaves room
// for both, else as a .txt attachment, the draft untouched.
export const sharedTextFitsAfter = (draft: string, text: string) => fitsInTextMessage(appendLine(draft, text))

// Mirrors PayloadFileName in rnmodules/kb-common, which names the long text the iOS share
// extension attaches, so a text file reads the same whichever side made it.
const maxNameBytes = 200
const maxTextNameChars = 40
const maxTextNameWords = 6
const fallbackName = 'shared-text'

const nonSpace = /\S/g
const space = /\s/g

// The first words, each cut to what could fit, without copying or splitting the whole text.
const firstWords = (text: string) => {
  const words: Array<string> = []
  let from = 0
  while (words.length < maxTextNameWords) {
    nonSpace.lastIndex = from
    const start = nonSpace.exec(text)?.index
    if (start === undefined) break
    space.lastIndex = start
    const end = space.exec(text)?.index ?? text.length
    words.push(text.slice(start, Math.min(end, start + 2 * (maxTextNameChars + 1))))
    from = end
  }
  return words
}

const chars = (s: string) => Array.from(s)

// A path separator would escape the folder, a leading dot would hide the file, and control
// characters (newlines) garble it in the UI.
// eslint-disable-next-line no-control-regex
const unsafe = /[/:\u0000-\u001f\u007f-\u009f\u2028\u2029]/g

const byteLength = (s: string) => chars(s).reduce((n, c) => n + utf8Bytes(c.codePointAt(0) ?? 0), 0)

export const sharedTextFileName = (text: string) => {
  const words = firstWords(text)
  let snippet = ''
  for (const word of words) {
    const next = snippet ? `${snippet} ${word}` : word
    if (chars(next).length > maxTextNameChars) break
    snippet = next
  }
  if (!snippet && words[0]) {
    snippet = chars(words[0]).slice(0, maxTextNameChars).join('')
  }
  // trimmed of what sanitize trims from the ends; "word..txt" reads as a typo
  let base = snippet
    .replace(/^[\s/.]+|[\s/.]+$/g, '')
    .replace(unsafe, '_')
  const cut = chars(base)
  while (cut.length && byteLength(cut.join('')) + '.txt'.length > maxNameBytes) {
    cut.pop()
  }
  base = cut.join('')
  return `${base || fallbackName}.txt`
}

// Writes the text to a new file in the app's cache, named from its first words. Each file gets its
// own folder, so two texts with the same first words never meet; remove deletes it. Mobile only.
export const writeSharedTextFile = async (text: string): Promise<{path: string; remove: () => void}> => {
  const dir = new Directory(Paths.cache, 'shared-text', makeUUID())
  dir.create({intermediates: true})
  const name = sharedTextFileName(text)
  await new File(dir, name).write(text)
  // the folder's uri is all safe characters, the name is not: build the path from the raw name
  const dirPath = decodeURIComponent(dir.uri.replace(/^file:\/\//, '')).replace(/\/$/, '')
  return {
    path: `${dirPath}/${name}`,
    remove: () => {
      try {
        dir.delete()
      } catch {}
    },
  }
}

// A share's text going out with its files: the text to follow them into the draft, or, when it
// has no room after the draft, the path of a .txt to send in the same batch. A text that can't be
// written stays text, and the composer has its own go at attaching it.
export const sharedTextForBatch = async (
  draft: string,
  text: string | undefined
): Promise<{text?: string; path?: string}> => {
  if (text === undefined || sharedTextFitsAfter(draft, text)) return {text}
  try {
    return {path: (await writeSharedTextFile(text)).path}
  } catch (error) {
    logger.warn('shared text: unable to write it as a file, leaving it for the draft', error)
    return {text}
  }
}
