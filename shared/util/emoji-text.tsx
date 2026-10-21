import {emojiIndexByName} from '@/common-adapters/markdown/emoji-gen'

const skinTone = /:skin-tone-\d{1,2}:/y

// Plain text with :shortcode: emoji replaced by the emoji itself, for places that show text
// without markdown (OS notifications). The service converts the names its own table knows; this
// covers the newer ones. Names that aren't standard emoji, like a team's custom emoji, stay as typed.
export const emojiShortcodesToText = (text: string) => {
  let out = ''
  let i = 0
  for (;;) {
    const start = text.indexOf(':', i)
    const end = start < 0 ? -1 : text.indexOf(':', start + 1)
    if (end < 0) break
    const name = text.slice(start, end + 1)
    const emoji = emojiIndexByName[name]
    if (!emoji) {
      // the closing colon may open the next shortcode (10:30:tada:)
      out += text.slice(i, end)
      i = end
      continue
    }
    skinTone.lastIndex = end + 1
    const tone = skinTone.exec(text)?.[0]
    if (tone) {
      // a tone the emoji has no variant for stays as text
      out += text.slice(i, start) + (emojiIndexByName[name + tone] ?? emoji + tone)
      i = end + 1 + tone.length
    } else {
      out += text.slice(i, start) + emoji
      i = end + 1
    }
  }
  return out + text.slice(i)
}
