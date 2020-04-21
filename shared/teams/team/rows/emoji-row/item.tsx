import * as React from 'react'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as ChatTypes from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as Teams from '../../../../constants/teams'
import * as TeamTypes from '../../../../constants/types/teams'
import * as RPCChatGen from '../../../../constants/types/rpc-chat-gen'
import * as dateFns from 'date-fns'
import {emojiDataToRenderableEmoji, renderEmoji, RPCToEmojiData} from '../../../../util/emoji'
import useRPC from '../../../../util/use-rpc'
import EmojiMenu from './emoji-menu'

type OwnProps = {
  conversationIDKey: ChatTypes.ConversationIDKey
  emoji: RPCChatTypes.Emoji
  firstItem: boolean
  reloadEmojis: () => void
  teamID: TeamTypes.TeamID
}

const ItemRow = ({conversationIDKey, emoji, firstItem, reloadEmojis, teamID}: OwnProps) => {
  const emojiData = RPCToEmojiData(emoji, false)
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const username = Container.useSelector(s => s.config.username)
  const canManageEmoji = Container.useSelector(s => Teams.getCanPerformByID(s, teamID).manageEmojis)
  const deleteOtherEmoji = Container.useSelector(s => Teams.getCanPerformByID(s, teamID).deleteOtherEmojis)
  const canRemove = canManageEmoji && (deleteOtherEmoji || emoji.creationInfo?.username === username)
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
  const isStockAlias = emoji.remoteSource.typ === RPCChatTypes.EmojiRemoteSourceTyp.stockalias
  const doAddAlias = !isStockAlias && canManageEmoji ? onAddAlias : undefined

  const removeRpc = useRPC(RPCChatGen.localRemoveEmojiRpcPromise)
  const doRemove = canRemove
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
      onAddAlias={doAddAlias}
      onRemove={doRemove}
      onHidden={() => setShowingPopup(false)}
      isAlias={emoji.isAlias}
    />
  ))

  return (
    <Kb.Box style={styles.outerContainer}>
      <Kb.ListItem2
        type="Small"
        body={
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            alignItems="center"
            style={styles.container}
            gap="small"
          >
            {renderEmoji(
              emojiDataToRenderableEmoji(RPCToEmojiData(emoji, false)),
              Styles.isMobile ? 32 : 26,
              false
            )}
            <Kb.Text type="Body" style={styles.alias}>{`:${emoji.alias}:`}</Kb.Text>
            {!Styles.isMobile && emoji.creationInfo && (
              <Kb.Text type="Body" style={styles.date}>
                {dateFns.format(emoji.creationInfo.time, 'EEE d MMM yyyy')}
              </Kb.Text>
            )}
            {!Styles.isMobile && emoji.creationInfo && (
              <Kb.NameWithIcon
                colorFollowing={true}
                colorBroken={true}
                horizontal={true}
                username={emoji.creationInfo.username}
                size="small"
                avatarSize={16}
                containerStyle={styles.username}
              />
            )}
            <Kb.Box2
              direction="horizontal"
              style={Styles.collapseStyles([!(doAddAlias || doRemove) ? {opacity: 0} : null])}
            >
              {popup}
              <Kb.Button
                icon="iconfont-ellipsis"
                mode="Secondary"
                type="Dim"
                onClick={() => setShowingPopup(!showingPopup)}
                ref={popupAnchor}
                small={true}
              />
            </Kb.Box2>
          </Kb.Box2>
        }
        firstItem={firstItem}
        fullDivider={true}
        height={Styles.isMobile ? 48 : 42}
      />
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      alias: Styles.platformStyles({
        common: {
          marginRight: 'auto',
        },
        isElectron: {
          marginLeft: Styles.globalMargins.large - Styles.globalMargins.tiny,
        },
        isMobile: {
          marginLeft: Styles.globalMargins.small,
        },
      }),
      container: {
        justifyContent: 'flex-end',
      },
      date: {
        maxWidth: 130,
        width: 130,
      },
      outerContainer: Styles.platformStyles({
        common: {backgroundColor: Styles.globalColors.white},
        isElectron: Styles.padding(0, Styles.globalMargins.small),
      }),
      username: {
        maxWidth: 210,
        width: 210,
      },
    } as const)
)

export default ItemRow
