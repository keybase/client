// just used to break import cycles
import type * as T from '../constants/types'
import emojidata from 'emoji-datasource-apple'
export type EmojiData = {
  category: string
  name?: string
  obsoleted_by?: string
  short_name: string
  short_names: Array<string>
  sort_order?: number
  skin_variations?: {[K in T.Chat.EmojiSkinTone]: Object}
  teamname?: string
  unified: string
  userEmojiRenderStock?: string
  userEmojiRenderUrl?: string
  sheet_x: number
  sheet_y: number
}
export const skinTones = ['1F3FA', '1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF'] as const
export const emojiNameMap = Object.values(emojidata).reduce((res: {[K in string]: EmojiData}, emoji: any) => {
  res[emoji.short_name] = emoji
  return res
}, {})
