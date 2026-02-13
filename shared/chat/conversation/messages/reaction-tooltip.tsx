import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import ReactButton from './react-button'
import type * as T from '@/constants/types'
import {MessageContext} from './ids-context'
import {useUsersState} from '@/stores/users'

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

const emptyStateProps = {
  _reactions: new Map<string, T.Chat.ReactionDesc>(),
  _usersInfo: new Map<string, T.Users.UserInfo>(),
}

const ReactionTooltip = (p: OwnProps) => {
  const {ordinal, onHidden, attachmentRef, onMouseLeave, onMouseOver, visible, emoji} = p

  const infoMap = useUsersState(s => s.infoMap)
  const {_reactions, good} = Chat.useChatContext(
    C.useShallow(s => {
      const message = s.messageMap.get(ordinal)
      if (message && Chat.isMessageWithReactions(message)) {
        const _reactions = message.reactions
        return {_reactions, good: true}
      }
      return {...emptyStateProps, good: false}
    })
  )
  const _usersInfo = good ? infoMap : emptyStateProps._usersInfo

  const navigateAppend = Chat.useChatNavigateAppend()
  const onAddReaction = React.useCallback(() => {
    onHidden()
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey, onPickAddToMessageOrdinal: ordinal, pickKey: 'reaction'},
      selected: 'chatChooseEmoji',
    }))
  }, [navigateAppend, onHidden, ordinal])

  let reactions = [...(_reactions?.keys() ?? [])]
    .map(emoji => {
      const reactionUsers = _reactions?.get(emoji)?.users ?? []
      const sortedUsers = [...reactionUsers].sort((a, b) => a.timestamp - b.timestamp)
      return {
        earliestTimestamp: sortedUsers[0]?.timestamp ?? 0,
        emoji,
        users: sortedUsers.map(r => ({
          fullName: (_usersInfo.get(r.username) || {fullname: ''}).fullname || '',
          username: r.username,
        })),
      }
    })
    .sort((a, b) => a.earliestTimestamp - b.earliestTimestamp)
    .map(({emoji, users}) => ({emoji, users}))
  if (!C.isMobile && emoji) {
    reactions = reactions.filter(r => r.emoji === emoji)
  }
  const insets = Kb.useSafeAreaInsets()
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const messageContext = React.useMemo(
    () => ({canFixOverdraw: false, isHighlighted: false, ordinal}),
    [ordinal]
  )
  if (!visible) {
    return null
  }

  const sections = reactions.map(r => ({
    data: r.users.map(u => ({...u, key: `${u.username}:${r.emoji}`})),
    key: r.emoji,
    ordinal: ordinal,
    title: r.emoji,
  }))

  return (
    <Kb.Overlay
      attachTo={attachmentRef}
      onHidden={onHidden}
      position="top center"
      positionFallbacks={positionFallbacks}
      propagateOutsideClicks={true}
      style={styles.overlay}
    >
      {/* need context since this uses a portal... */}
      <Chat.ChatProvider id={conversationIDKey}>
        <MessageContext.Provider value={messageContext}>
          <Kb.Box2
            onMouseLeave={onMouseLeave}
            onMouseOver={onMouseOver}
            direction="vertical"
            gap="tiny"
            style={Kb.Styles.collapseStyles([styles.listContainer, {paddingBottom: insets.bottom}])}
          >
            {Kb.Styles.isMobile && (
              <Kb.Box2 direction="horizontal">
                <Kb.Text type="BodySemiboldLink" onClick={onHidden} style={styles.closeButton}>
                  Close
                </Kb.Text>
                <Kb.Box2 direction="horizontal" style={{flex: 1}} />
              </Kb.Box2>
            )}
            <Kb.SectionList
              alwaysBounceVertical={false}
              initialNumToRender={19} // Keeps height from trashing on mobile
              sections={sections}
              stickySectionHeadersEnabled={true}
              contentContainerStyle={styles.list}
              renderItem={renderItem}
              renderSectionHeader={renderSectionHeader}
            />
            {Kb.Styles.isMobile && (
              <Kb.ButtonBar style={styles.addReactionButtonBar}>
                <Kb.Button mode="Secondary" fullWidth={true} onClick={onAddReaction} label="Add a reaction">
                  <Kb.Icon
                    type="iconfont-reacji"
                    color={Kb.Styles.globalColors.blue}
                    style={styles.addReactionButtonIcon}
                  />
                </Kb.Button>
              </Kb.ButtonBar>
            )}
          </Kb.Box2>
        </MessageContext.Provider>
      </Chat.ChatProvider>
    </Kb.Overlay>
  )
}

type ListItem = {
  fullName: string
  key: string
  username: string
}

const renderItem = ({item}: {item: ListItem}) => {
  return (
    <Kb.NameWithIcon
      key={item.key}
      colorFollowing={true}
      containerStyle={styles.userContainer}
      horizontal={true}
      metaOne={item.fullName}
      username={item.username}
    />
  )
}

const renderSectionHeader = ({
  section,
}: {
  section: {
    data: Array<ListItem>
    ordinal: T.Chat.Ordinal
    title: string
  }
}) => (
  <Kb.Box2
    key={section.title}
    direction="horizontal"
    gap="tiny"
    gapStart={true}
    gapEnd={true}
    fullWidth={true}
    style={styles.buttonContainer}
  >
    <ReactButton emoji={section.title} />
    <Kb.Text type="Terminal" lineClamp={1} style={styles.emojiText}>
      {section.title}
    </Kb.Text>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      addReactionButtonBar: {
        paddingBottom: Kb.Styles.globalMargins.medium,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.small,
      },
      addReactionButtonIcon: {marginRight: Kb.Styles.globalMargins.tiny},
      addReactionButtonText: {color: Kb.Styles.globalColors.black_50},
      buttonContainer: {
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.white,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
        flexShrink: 0,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      closeButton: {padding: Kb.Styles.globalMargins.small},
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
        common: {backgroundColor: Kb.Styles.globalColors.white},
        isElectron: {
          maxHeight: 320,
          width: 240,
        },
        isMobile: {
          maxHeight: '90%',
          width: '100%',
        },
      }),
      overlay: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white,
          margin: Kb.Styles.globalMargins.tiny,
        },
      }),
      userContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        paddingBottom: Kb.Styles.globalMargins.xtiny,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.xtiny,
      },
    }) as const
)

export default ReactionTooltip
