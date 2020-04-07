import * as React from 'react'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as ChatTypes from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as RPCChatGen from '../../../../constants/types/rpc-chat-gen'
import * as dateFns from 'date-fns'
import {emojiDataToRenderableEmoji, renderEmoji, RPCToEmojiData} from '../../../../util/emoji'
import useRPC from '../../../../util/use-rpc'
import EmojiMenu from './emoji-menu'

type OwnProps = {
  conversationIDKey: ChatTypes.ConversationIDKey
  emoji: RPCChatTypes.Emoji
  reloadEmojis: () => void
}

const ItemRow = ({conversationIDKey, emoji, reloadEmojis}: OwnProps) => {
  const emojiData = RPCToEmojiData(emoji)
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onAddAlias = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [
          {
            props: {conversationIDKey, defaultSelected: emojiData, onChange: reloadEmojis},
            selected: 'teamAddEmojiAlias',
          },
        ],
      })
    )

  const canManageEmoji = true
  const removeRpc = useRPC(RPCChatGen.localRemoveEmojiRpcPromise)
  const doRemove = canManageEmoji
    ? () => {
        removeRpc(
          [
            {
              alias: emojiData.short_name,
              convID: ChatTypes.keyToConversationID(conversationIDKey),
            },
          ],
          () => reloadEmojis(),
          err => {
            throw err
          }
        )
      }
    : undefined

  const {showingPopup, setShowingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <EmojiMenu
      attachTo={attachTo}
      visible={showingPopup}
      onAddAlias={onAddAlias}
      onRemove={doRemove}
      onHidden={() => setShowingPopup(false)}
    />
  ))

  return (
    <Kb.ListItem2
      icon={renderEmoji(emojiDataToRenderableEmoji(RPCToEmojiData(emoji)), 32)}
      type="Large"
      body={
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          alignItems="center"
          style={styles.container}
          gap="small"
        >
          <Kb.Text type="Body" style={styles.alias}>{`:${emoji.alias}:`}</Kb.Text>
          {emoji.creationInfo && (
            <Kb.Text type="Body" style={styles.date}>
              {dateFns.format(emoji.creationInfo.time, 'EEE d MMM yyyy')}
            </Kb.Text>
          )}
          {emoji.creationInfo && (
            <Kb.NameWithIcon
              horizontal={true}
              username={emoji.creationInfo.username}
              size="small"
              avatarSize={24}
              containerStyle={styles.username}
            />
          )}
          <Kb.Box2 direction="horizontal">
            {popup}
            <Kb.Button
              icon="iconfont-ellipsis"
              mode="Secondary"
              type="Dim"
              onClick={() => setShowingPopup(!showingPopup)}
              ref={popupAnchor}
            />
          </Kb.Box2>
        </Kb.Box2>
      }
      firstItem={false}
    />
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      alias: {
        marginRight: 'auto',
      },
      container: {
        justifyContent: 'flex-end',
      },
      date: {
        maxWidth: 130,
        width: 130,
      },
      username: {
        maxWidth: 210,
        width: 210,
      },
    } as const)
)

export default ItemRow
