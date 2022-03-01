import * as React from 'react'
import * as Styles from '../../../../styles'
import * as Common from './common'
import {
  emojiDataToRenderableEmoji,
  renderEmoji,
  type EmojiData /*, RPCToEmojiData*/,
} from '../../../../util/emoji'
import * as Kb from '../../../../common-adapters'

export const transformer = (
  emoji: EmojiData,
  marker: string,
  tData: Common.TransformerData,
  preview: boolean
) => {
  return Common.standardTransformer(`${marker}${emoji.short_name}:`, tData, preview)
}

export const keyExtractor = (item: EmojiData) => item.short_name

export const Renderer = (p: any) => {
  const item: EmojiData = p.value
  const selected: boolean = p.selected
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Styles.collapseStyles([
        Common.styles.suggestionBase,
        {backgroundColor: selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white},
      ])}
      gap="small"
    >
      {renderEmoji(emojiDataToRenderableEmoji(item), 24, false)}
      <Kb.Text type="BodySmallSemibold">{item.short_name}</Kb.Text>
    </Kb.Box2>
  )
}
