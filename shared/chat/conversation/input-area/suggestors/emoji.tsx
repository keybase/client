import * as Common from './common'
import * as Chat2Gen from '../../../../actions/chat2-gen'
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

export const useDataSource = (conversationIDKey: Types.ConversationIDKey, filter: string) => {
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    dispatch(Chat2Gen.createFetchUserEmoji({conversationIDKey}))
  }, [dispatch, conversationIDKey])

  // TODO remove from store
  const userEmojis = Container.useSelector(state => state.chat2.userEmojisForAutocomplete)
  // TODO remove from store
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
  let emojiData: Array<EmojiData> = []
  emojiIndex.search(filter)?.forEach((res: {id?: string}) => {
    res.id && emojiData.push(emojiNameMap[res.id])
  })

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
