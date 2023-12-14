import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Container from '@/util/container'
import * as Kb from '@/common-adapters'
import * as dateFns from 'date-fns'
import {emojiDataToRenderableEmoji, renderEmoji, RPCToEmojiData} from '@/util/emoji'
import EmojiMenu from './emoji-menu'
import {useEmojiState} from '@/teams/emojis/use-emoji'

type OwnProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  emoji: T.RPCChat.Emoji
  firstItem: boolean
  teamID: T.Teams.TeamID
}

const ItemRow = ({conversationIDKey, emoji, firstItem, teamID}: OwnProps) => {
  const emojiData = RPCToEmojiData(emoji, false)
  const nav = Container.useSafeNavigation()
  const username = C.useCurrentUserState(s => s.username)
  const canManageEmoji = C.useTeamsState(s => C.Teams.getCanPerformByID(s, teamID).manageEmojis)
  const deleteOtherEmoji = C.useTeamsState(s => C.Teams.getCanPerformByID(s, teamID).deleteOtherEmojis)
  const canRemove = canManageEmoji && (deleteOtherEmoji || emoji.creationInfo?.username === username)
  const onAddAlias = C.useEvent(() => {
    nav.safeNavigateAppend({
      props: {conversationIDKey, defaultSelected: emojiData},
      selected: 'teamAddEmojiAlias',
    })
  })
  const isStockAlias = emoji.remoteSource.typ === T.RPCChat.EmojiRemoteSourceTyp.stockalias
  const doAddAlias = !isStockAlias && canManageEmoji ? onAddAlias : undefined

  const refreshEmoji = useEmojiState(s => s.dispatch.triggerEmojiUpdated)
  const removeRpc = C.useRPC(T.RPCChat.localRemoveEmojiRpcPromise)
  const doRemove = React.useMemo(
    () =>
      canRemove
        ? () => {
            removeRpc(
              [
                {
                  alias: emojiData.short_name,
                  convID: T.Chat.keyToConversationID(conversationIDKey),
                },
              ],
              () => refreshEmoji(),
              err => {
                throw err
              }
            )
          }
        : undefined,
    [canRemove, emojiData.short_name, conversationIDKey, removeRpc, refreshEmoji]
  )
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <EmojiMenu
          attachTo={attachTo}
          visible={true}
          onAddAlias={doAddAlias}
          onRemove={doRemove}
          onHidden={hidePopup}
          isAlias={emoji.isAlias}
        />
      )
    },
    [doAddAlias, doRemove, emoji.isAlias]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

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
            {renderEmoji({
              emoji: emojiDataToRenderableEmoji(RPCToEmojiData(emoji, false)),
              showTooltip: false,
              size: Kb.Styles.isMobile ? 32 : 26,
            })}
            <Kb.Text type="Body" style={styles.alias}>{`:${emoji.alias}:`}</Kb.Text>
            {!Kb.Styles.isMobile && emoji.creationInfo && (
              <Kb.Text type="Body" style={styles.date}>
                {dateFns.format(emoji.creationInfo.time, 'EEE d MMM yyyy')}
              </Kb.Text>
            )}
            {!Kb.Styles.isMobile && emoji.creationInfo && (
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
              style={Kb.Styles.collapseStyles([!(doAddAlias || doRemove) ? {opacity: 0} : null])}
            >
              {popup}
              <Kb.Button
                icon="iconfont-ellipsis"
                mode="Secondary"
                type="Dim"
                onClick={showPopup}
                ref={popupAnchor}
                small={true}
              />
            </Kb.Box2>
          </Kb.Box2>
        }
        firstItem={firstItem}
        fullDivider={true}
        height={Kb.Styles.isMobile ? 48 : 42}
      />
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      alias: Kb.Styles.platformStyles({
        common: {
          marginRight: 'auto',
        },
        isElectron: {
          marginLeft: Kb.Styles.globalMargins.large - Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          marginLeft: Kb.Styles.globalMargins.small,
        },
      }),
      container: {
        justifyContent: 'flex-end',
      },
      date: {
        maxWidth: 130,
        width: 130,
      },
      outerContainer: Kb.Styles.platformStyles({
        common: {backgroundColor: Kb.Styles.globalColors.white},
        isElectron: Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
      }),
      username: {
        maxWidth: 210,
        width: 210,
      },
    }) as const
)

export default ItemRow
