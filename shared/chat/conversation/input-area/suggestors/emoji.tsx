import * as Common from './common'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import * as Waiting from '../../../../constants/waiting'
import type * as Types from '../../../../constants/types/chat2'
import {emojiDataToRenderableEmoji, renderEmoji, type EmojiData, RPCToEmojiData} from '../../../../util/emoji'
import {emojiIndex, emojiNameMap} from '../../messages/react-button/emoji-picker/data'

export const transformer = (
  emoji: EmojiData,
  marker: string,
  tData: Common.TransformerData,
  preview: boolean
) => {
  return Common.standardTransformer(`${marker}${emoji.short_name}:`, tData, preview)
}

const keyExtractor = (item: EmojiData) => item.short_name

const ItemRenderer = (p: {selected: boolean; item: EmojiData}) => {
  const {item, selected} = p
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

// 2+ valid emoji chars and no ending colon
const emojiPrepass = /[a-z0-9_]{2,}(?!.*:)/i

export const useDataSource = (_conversationIDKey: Types.ConversationIDKey, filter: string) => {
  return Container.useSelector(state => {
    if (!emojiPrepass.test(filter)) {
      return {
        items: [],
        loading: false,
      }
    }

    // prefill data with stock emoji
    let emojiData: Array<EmojiData> = []
    emojiIndex.search(filter)?.forEach((res: {id?: string}) => {
      if (res.id) {
        emojiData.push(emojiNameMap[res.id])
      }
    })

    // TODO remove from store
    const userEmojis = state.chat2.userEmojisForAutocomplete

    if (userEmojis) {
      const userEmoji = userEmojis
        .filter(emoji => emoji.alias.toLowerCase().includes(filter))
        .map(emoji => RPCToEmojiData(emoji, false))
      emojiData = userEmoji.sort((a, b) => a.short_name.localeCompare(b.short_name)).concat(emojiData)
    }

    const userEmojisLoading = Waiting.anyWaiting(state, Constants.waitingKeyLoadingEmoji)

    return {
      items: emojiData,
      loading: userEmojisLoading,
    }
  })
}

type ListProps = Pick<
  Common.ListProps<EmojiData>,
  'expanded' | 'suggestBotCommandsUpdateStatus' | 'listStyle' | 'spinnerStyle'
> & {
  conversationIDKey: Types.ConversationIDKey
  filter: string
  onSelected: (item: EmojiData, final: boolean) => void
  onMoveRef: React.MutableRefObject<((up: boolean) => void) | undefined>
  onSubmitRef: React.MutableRefObject<(() => void) | undefined>
}
export const List = (p: ListProps) => {
  const {conversationIDKey, filter, ...rest} = p
  const {items, loading} = useDataSource(conversationIDKey, filter)
  return (
    <Common.List
      {...rest}
      keyExtractor={keyExtractor}
      items={items}
      ItemRenderer={ItemRenderer}
      loading={loading}
    />
  )
}
