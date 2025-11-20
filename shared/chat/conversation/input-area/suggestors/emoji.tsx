import * as C from '@/constants'
import * as Common from './common'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {
  emojiSearch,
  emojiDataToRenderableEmoji,
  type EmojiData,
  RPCToEmojiData,
} from '@/common-adapters/emoji'

export const transformer = (
  emoji: EmojiData,
  marker: string,
  tData: Common.TransformerData,
  preview: boolean
) => {
  return Common.standardTransformer(`${marker}${emoji.short_name}:`, tData, preview)
}

const keyExtractor = (_item: EmojiData, idx: number) => String(idx) // emojis can have conflicts on the names

const ItemRenderer = (p: Common.ItemRendererProps<EmojiData>) => {
  const {item, selected} = p
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Kb.Styles.collapseStyles([
        Common.styles.suggestionBase,
        {backgroundColor: selected ? Kb.Styles.globalColors.blueLighter2 : Kb.Styles.globalColors.white},
      ])}
      gap="small"
    >
      <Kb.Emoji emoji={emojiDataToRenderableEmoji(item)} showTooltip={false} size={24} />
      <Kb.Text type="BodySmallSemibold">{item.short_name}</Kb.Text>
    </Kb.Box2>
  )
}

// 2+ valid emoji chars and no ending colon
const emojiPrepass = /[a-z0-9_]{2,}(?!.*:)/i
const empty = new Array<EmojiData>()

const useDataSource = (filter: string) => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const fetchUserEmoji = C.useChatState(s => s.dispatch.fetchUserEmoji)
  React.useEffect(() => {
    fetchUserEmoji(conversationIDKey)
  }, [conversationIDKey, fetchUserEmoji])

  const userEmojisLoading = C.Waiting.useAnyWaiting(C.Chat.waitingKeyLoadingEmoji)
  const userEmojis = C.useChatState(s => s.userEmojisForAutocomplete)

  if (!emojiPrepass.test(filter)) {
    return {
      items: empty,
      loading: false,
    }
  }

  // prefill data with stock emoji
  let emojiData: Array<EmojiData> = emojiSearch(filter, 50)

  if (userEmojis) {
    const userEmoji = userEmojis
      .filter(emoji => emoji.alias.toLowerCase().includes(filter))
      .map(emoji => RPCToEmojiData(emoji, false))
    emojiData = userEmoji.sort((a, b) => a.short_name.localeCompare(b.short_name)).concat(emojiData)
  }

  return {
    items: emojiData,
    loading: userEmojisLoading,
  }
}

type ListProps = Pick<
  Common.ListProps<EmojiData>,
  'expanded' | 'suggestBotCommandsUpdateStatus' | 'listStyle' | 'spinnerStyle'
> & {
  filter: string
  onSelected: (item: EmojiData, final: boolean) => void
  setOnMoveRef: (r: (up: boolean) => void) => void
  setOnSubmitRef: (r: () => boolean) => void
}
export const List = (p: ListProps) => {
  const {filter, ...rest} = p
  const {items, loading} = useDataSource(filter)
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
