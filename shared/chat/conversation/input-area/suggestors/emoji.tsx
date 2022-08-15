import * as Common from './common'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import * as Waiting from '../../../../constants/waiting'
import type * as Types from '../../../../constants/types/chat2'
import {
  emojiSearch,
  emojiDataToRenderableEmoji,
  renderEmoji,
  type EmojiData,
  RPCToEmojiData,
} from '../../../../util/emoji'

export const transformer = (
  emoji: EmojiData,
  marker: string,
  tData: Common.TransformerData,
  preview: boolean
) => {
  return Common.standardTransformer(`${marker}${emoji.short_name}:`, tData, preview)
}

const keyExtractor = (item: EmojiData) => item.short_name

const ItemRenderer = (p: Common.ItemRendererProps<EmojiData>) => {
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
      {renderEmoji({emoji: emojiDataToRenderableEmoji(item), showTooltip: false, size: 24})}
      <Kb.Text type="BodySmallSemibold">{item.short_name}</Kb.Text>
    </Kb.Box2>
  )
}

// 2+ valid emoji chars and no ending colon
const emojiPrepass = /[a-z0-9_]{2,}(?!.*:)/i

export const useDataSource = (conversationIDKey: Types.ConversationIDKey, filter: string) => {
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    dispatch(Chat2Gen.createFetchUserEmoji({conversationIDKey}))
  }, [dispatch, conversationIDKey])

  const userEmojis = Container.useSelector(state => state.chat2.userEmojisForAutocomplete)
  const userEmojisLoading = Container.useSelector(state =>
    Waiting.anyWaiting(state, Constants.waitingKeyLoadingEmoji)
  )

  if (!emojiPrepass.test(filter)) {
    return {
      items: [],
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
  conversationIDKey: Types.ConversationIDKey
  filter: string
  onSelected: (item: EmojiData, final: boolean) => void
  onMoveRef: React.MutableRefObject<((up: boolean) => void) | undefined>
  onSubmitRef: React.MutableRefObject<(() => boolean) | undefined>
}
export const List = (p: ListProps) => {
  const {filter, ...rest} = p
  const {items, loading} = useDataSource(p.conversationIDKey, filter)
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
