// just used to break import cycles
import emojidata, {type EmojiData} from 'emoji-datasource-apple'
export const skinTones = ['1F3FA', '1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF'] as const
export const emojiNameMap = Object.values(emojidata).reduce<{[K in string]: EmojiData}>((res, emoji) => {
  res[emoji.short_name] = emoji
  return res
}, {})

export type {EmojiData} from 'emoji-datasource-apple'
