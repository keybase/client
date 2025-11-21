import * as T from '@/constants/types'
import NativeEmoji from './native-emoji'
import type * as ED from './slow-data'
import type * as Styles from '@/styles'
import CustomEmoji from './custom-emoji'

const Kb = {
  NativeEmoji,
}

export type RenderableEmoji = {
  aliasForCustom?: string
  unicodeStock?: string
  renderStock?: string
  renderUrl?: string
}

export const RPCUserReacjiToRenderableEmoji = (
  userReacji: T.RPCGen.UserReacji,
  noAnim: boolean
): RenderableEmoji => ({
  aliasForCustom: userReacji.name,
  renderStock: userReacji.customAddr ? undefined : userReacji.name,
  renderUrl: noAnim ? userReacji.customAddrNoAnim || undefined : userReacji.customAddr || undefined,
})

export const emojiDataToRenderableEmoji = (
  emoji: ED.EmojiData,
  skinToneModifier?: string,
  skinToneKey?: T.Chat.EmojiSkinTone
): RenderableEmoji => ({
  aliasForCustom: emoji.short_name,
  renderStock: emoji.userEmojiRenderStock ?? `:${emoji.short_name}:${skinToneModifier ?? ''}`,
  renderUrl: emoji.userEmojiRenderUrl,
  unicodeStock:
    emoji.unified &&
    String.fromCodePoint(
      ...(skinToneModifier && skinToneKey
        ? (emoji.skin_variations?.[skinToneKey]?.unified ?? '')
        : emoji.unified
      )
        .split('-')
        .map((str: string) => Number.parseInt(str, 16))
    ),
})

export const getEmojiStr = (emoji: ED.EmojiData, skinToneModifier?: string) => {
  if (emoji.userEmojiRenderUrl || emoji.userEmojiRenderStock) {
    return `:${emoji.short_name}:`
  }

  return `:${emoji.short_name}:${skinToneModifier ?? ''}`
}

export function RPCToEmojiData(emoji: T.RPCChat.Emoji, noAnim: boolean, category?: string): ED.EmojiData {
  return {
    category: category ?? '',
    name: undefined,
    non_qualified: '',
    sheet_x: -1,
    sheet_y: -1,
    short_name: emoji.alias,
    short_names: [emoji.alias],
    sort_order: -1,
    teamname: emoji.teamname ?? undefined,
    unified: '',
    userEmojiRenderStock:
      emoji.source.typ === T.RPCChat.EmojiLoadSourceTyp.str ? emoji.source.str : undefined,
    userEmojiRenderUrl:
      emoji.source.typ === T.RPCChat.EmojiLoadSourceTyp.str
        ? undefined
        : noAnim && emoji.noAnimSource.typ === T.RPCChat.EmojiLoadSourceTyp.httpsrv
          ? emoji.noAnimSource.httpsrv
          : emoji.source.httpsrv,
  }
}

type CommonProps = {
  size: 16 | 18 | 22 | 24 | 26 | 28 | 32 | 36
  showTooltip: boolean
  virtualText?: boolean
  customStyle?: Styles.StylesCrossPlatform
  style?: Styles.StylesCrossPlatform
}
type EmojiProps =
  | ({
      emojiData: ED.EmojiData
      skinToneModifier?: string
      skinToneKey?: T.Chat.EmojiSkinTone
    } & CommonProps)
  | ({
      userReacji: T.RPCGen.UserReacji
      noAnim: boolean
    } & CommonProps)
  | ({
      emoji: RenderableEmoji
    } & CommonProps)

const Emoji = (props: EmojiProps) => {
  const {size, showTooltip, virtualText, customStyle, style} = props

  let emoji: RenderableEmoji
  if ('emojiData' in props) {
    emoji = emojiDataToRenderableEmoji(props.emojiData, props.skinToneModifier, props.skinToneKey)
  } else if ('userReacji' in props) {
    emoji = RPCUserReacjiToRenderableEmoji(props.userReacji, props.noAnim)
  } else {
    emoji = props.emoji
  }

  if (emoji.renderUrl) {
    return (
      <CustomEmoji
        size={size}
        src={emoji.renderUrl}
        alias={showTooltip ? emoji.aliasForCustom : undefined}
        style={customStyle}
      />
    )
  }

  if (emoji.renderStock) {
    return (
      <Kb.NativeEmoji
        size={size}
        emojiName={emoji.renderStock}
        disableSelecting={virtualText}
        style={style}
      />
    )
  }

  return null
}

export default Emoji
export {emojiData} from './data'
export {type EmojiData} from './slow-data'
