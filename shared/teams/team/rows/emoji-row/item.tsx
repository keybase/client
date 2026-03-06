import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as dateFns from 'date-fns'
import {RPCToEmojiData} from '@/common-adapters/emoji'
import EmojiMenu from './emoji-menu'
import {useEmojiState} from '@/teams/emojis/use-emoji'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useCurrentUserState} from '@/stores/current-user'

type OwnProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  emoji: T.RPCChat.Emoji
  firstItem: boolean
  teamID: T.Teams.TeamID
}

const ItemRow = ({conversationIDKey, emoji, firstItem, teamID}: OwnProps) => {
  const emojiData = RPCToEmojiData(emoji, false)
  const nav = useSafeNavigation()
  const username = useCurrentUserState(s => s.username)
  const canManageEmoji = Teams.useTeamsState(s => Teams.getCanPerformByID(s, teamID).manageEmojis)
  const deleteOtherEmoji = Teams.useTeamsState(s => Teams.getCanPerformByID(s, teamID).deleteOtherEmojis)
  const canRemove = canManageEmoji && (deleteOtherEmoji || emoji.creationInfo?.username === username)
  const onAddAlias = () => {
    nav.safeNavigateAppend({
      name: 'teamAddEmojiAlias',
      params: {conversationIDKey, defaultSelected: emojiData},
    })
  }
  const isStockAlias = emoji.remoteSource.typ === T.RPCChat.EmojiRemoteSourceTyp.stockalias
  const doAddAlias = !isStockAlias && canManageEmoji ? onAddAlias : undefined

  const refreshEmoji = useEmojiState(s => s.dispatch.triggerEmojiUpdated)
  const removeRpc = C.useRPC(T.RPCChat.localRemoveEmojiRpcPromise)
  const doRemove = canRemove
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
    : undefined
  const makePopup = (p: Kb.Popup2Parms) => {
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
  }
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.outerContainer}>
      <Kb.ListItem
        type="Small"
        body={
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            alignItems="center"
            justifyContent="flex-end"
            gap="small"
          >
            <Kb.Emoji
              emojiData={RPCToEmojiData(emoji, false)}
              showTooltip={false}
              size={Kb.Styles.isMobile ? 32 : 26}
            />
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
              <Kb.IconButton
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
    </Kb.Box2>
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
