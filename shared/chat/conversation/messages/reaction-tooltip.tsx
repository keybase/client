import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import ReactButton from './react-button'
import * as T from '@/constants/types'
import {BottomSheetScrollView} from '@/common-adapters/popup/bottom-sheet'
import {MessageContext} from './ids-context'
import {useUsersState} from '@/stores/users'
import {useConversationThreadID, useConversationThreadMessage, useConversationThreadMessageActions} from '../thread-context'

const positionFallbacks = ['bottom center', 'left center'] as const

type OwnProps = {
  attachmentRef?: React.RefObject<Kb.MeasureRef | null>
  emoji?: string
  onHidden: () => void
  onMouseLeave?: (syntheticEvent: React.SyntheticEvent) => void
  onMouseOver?: (syntheticEvent: React.SyntheticEvent) => void
  ordinal: T.Chat.Ordinal
  visible: boolean
}

const emptyReactions = new Map<string, T.Chat.ReactionDesc>()
const emptyUsersInfo = new Map<string, T.Users.UserInfo>()

type Section = {
  data: Array<ListItem>
  ordinal: T.Chat.Ordinal
  reaction: T.Chat.ReactionDesc
  title: string
}

const ReactionTooltip = (p: OwnProps) => {
  const {ordinal, onHidden, attachmentRef, onMouseLeave, onMouseOver, visible, emoji} = p

  const message = useConversationThreadMessage(ordinal)
  const reactions = message && Chat.isMessageWithReactions(message) ? message.reactions : undefined
  const usersInfo = useUsersState(s => (reactions ? s.infoMap : emptyUsersInfo))
  const {toggleMessageReaction} = useConversationThreadMessageActions()
  const conversationIDKey = useConversationThreadID()
  const hasMessageID = !!message && !!T.Chat.messageIDToNumber(message.id)

  const onAddReaction = () => {
    if (!message || !T.Chat.messageIDToNumber(message.id)) {
      return
    }
    onHidden()
    C.Router2.navigateAppend({
      name: 'chatChooseEmoji',
      params: {conversationIDKey, onPickAddToMessageID: message.id, pickKey: 'reaction'},
    })
  }

  let reactionsToShow = [...(reactions?.keys() ?? emptyReactions.keys())]
    .map(emoji => {
      const reaction = reactions?.get(emoji)
      const reactionUsers = reactions?.get(emoji)?.users ?? []
      const sortedUsers = [...reactionUsers].sort((a, b) => a.timestamp - b.timestamp)
      return {
        earliestTimestamp: sortedUsers[0]?.timestamp ?? 0,
        emoji,
        reaction,
        users: sortedUsers.map(r => ({
          fullName: (usersInfo.get(r.username) || {fullname: ''}).fullname || '',
          username: r.username,
        })),
      }
    })
    .filter((r): r is {earliestTimestamp: number; emoji: string; reaction: T.Chat.ReactionDesc; users: Array<ListItem>} => !!r.reaction)
    .sort((a, b) => a.earliestTimestamp - b.earliestTimestamp)
    .map(({emoji, reaction, users}) => ({emoji, reaction, users}))
  if (!isMobile && emoji) {
    reactionsToShow = reactionsToShow.filter(r => r.emoji === emoji)
  }
  const insets = Kb.useSafeAreaInsets()
  const messageContext = {isHighlighted: false, ordinal}
  const onClickUser = React.useCallback(
    (username: string) => {
      onHidden()
      C.Router2.navToProfile(username)
    },
    [onHidden]
  )
  const renderItem = React.useCallback(
    ({item}: {item: ListItem}) => (
      <Kb.NameWithIcon
        colorFollowing={true}
        containerStyle={styles.userContainer}
        horizontal={true}
        metaOne={item.fullName}
        onClick={onClickUser}
        clickType="onClick"
        withProfileCardPopup={false}
        username={item.username}
      />
    ),
    [onClickUser]
  )
  if (!visible) {
    return null
  }

  const sections = reactionsToShow.map(r => ({
    data: r.users.map(u => ({...u, key: `${u.username}:${r.emoji}`})),
    key: r.emoji,
    ordinal: ordinal,
    reaction: r.reaction,
    title: r.emoji,
  }))
  const renderSectionHeader = ({section}: {section: Section}) => (
    <Kb.Box2
      key={section.title}
      direction="horizontal"
      gap="tiny"
      gapStart={true}
      gapEnd={true}
      fullWidth={true}
      centerChildren={true}
      noShrink={true}
      style={styles.buttonContainer}
    >
      <ReactButton
        emoji={section.title}
        reaction={section.reaction}
        toggleReaction={emoji => toggleMessageReaction(section.ordinal, emoji)}
      />
      <Kb.Text type="Terminal" lineClamp={1} style={styles.emojiText}>
        {section.title}
      </Kb.Text>
    </Kb.Box2>
  )

  if (isMobile) {
    return (
      <Kb.Popup onHidden={onHidden}>
        <MessageContext value={messageContext}>
          <BottomSheetScrollView>
            <Kb.Box2
              direction="vertical"
              fullWidth={true}
              style={Kb.Styles.collapseStyles([styles.sheetContainer, {paddingBottom: insets.bottom}])}
            >
              {sections.map(section => (
                <React.Fragment key={section.key}>
                  {renderSectionHeader({section})}
                  {section.data.map(item => (
                    <React.Fragment key={item.key}>{renderItem({item})}</React.Fragment>
                  ))}
                </React.Fragment>
              ))}
              <Kb.ButtonBar style={styles.addReactionButtonBar}>
                <Kb.Button
                  disabled={!hasMessageID}
                  mode="Secondary"
                  fullWidth={true}
                  onClick={hasMessageID ? onAddReaction : undefined}
                  label="Add a reaction"
                >
                  <Kb.Icon
                    type="iconfont-reacji"
                    color={Kb.Styles.globalColors.blue}
                    style={styles.addReactionButtonIcon}
                  />
                </Kb.Button>
              </Kb.ButtonBar>
            </Kb.Box2>
          </BottomSheetScrollView>
        </MessageContext>
      </Kb.Popup>
    )
  }

  return (
    <Kb.Popup
      attachTo={attachmentRef}
      onHidden={onHidden}
      position="top center"
      positionFallbacks={positionFallbacks}
      propagateOutsideClicks={true}
      style={styles.overlay}
    >
      <MessageContext value={messageContext}>
        <Kb.Box2
          onMouseLeave={onMouseLeave}
          onMouseOver={onMouseOver}
          direction="vertical"
          gap="tiny"
          style={styles.listContainer}
        >
          <Kb.SectionList
            alwaysBounceVertical={false}
            initialNumToRender={19}
            sections={sections}
            stickySectionHeadersEnabled={true}
            contentContainerStyle={styles.list}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
          />
        </Kb.Box2>
      </MessageContext>
    </Kb.Popup>
  )
}

type ListItem = {
  fullName: string
  key: string
  username: string
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      addReactionButtonBar: {
        ...Kb.Styles.padding(
          Kb.Styles.globalMargins.small,
          Kb.Styles.globalMargins.small,
          Kb.Styles.globalMargins.medium
        ),
      },
      addReactionButtonIcon: {marginRight: Kb.Styles.globalMargins.tiny},
      buttonContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
        ...Kb.Styles.paddingV(Kb.Styles.globalMargins.tiny),
      },
      emojiText: {
        color: Kb.Styles.globalColors.black_50,
        flex: -1,
      },
      list: Kb.Styles.platformStyles({
        isElectron: {
          flex: 1,
          paddingBottom: Kb.Styles.globalMargins.small,
        },
      }),
      listContainer: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white,
          maxHeight: 320,
          width: 240,
        },
      }),
      overlay: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white,
          margin: Kb.Styles.globalMargins.tiny,
        },
      }),
      sheetContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        borderRadius: Kb.Styles.borderRadius,
      },
      userContainer: {
        alignSelf: 'stretch',
        backgroundColor: Kb.Styles.globalColors.white,
        ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
        ...Kb.Styles.paddingV(Kb.Styles.globalMargins.xtiny),
        width: '100%',
      },
    }) as const
)

export default ReactionTooltip
