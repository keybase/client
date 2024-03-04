import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import ReactButton from './react-button/container'
import type * as T from '@/constants/types'
import {OrdinalContext} from './ids-context'

const positionFallbacks = ['bottom center', 'left center'] as const

export type Props = {
  attachmentRef?: React.RefObject<Kb.MeasureRef>
  onAddReaction: () => void
  onHidden: () => void
  onMouseLeave?: (syntheticEvent: React.SyntheticEvent) => void
  onMouseOver?: (syntheticEvent: React.SyntheticEvent) => void
  ordinal: T.Chat.Ordinal
  reactions: Array<{
    emoji: string
    users: Array<{
      fullName: string
      username: string
    }>
  }>
  visible: boolean
}

type OwnProps = {
  attachmentRef?: React.RefObject<Kb.MeasureRef>
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

  const infoMap = C.useUsersState(s => s.infoMap)
  const {_reactions, good} = C.useChatContext(
    C.useShallow(s => {
      const message = s.messageMap.get(ordinal)
      if (message && C.Chat.isMessageWithReactions(message)) {
        const _reactions = message.reactions
        return {_reactions, good: true}
      }
      return {...emptyStateProps, good: false}
    })
  )
  const _usersInfo = good ? infoMap : emptyStateProps._usersInfo

  const navigateAppend = C.Chat.useChatNavigateAppend()
  const onAddReaction = React.useCallback(() => {
    onHidden()
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey, onPickAddToMessageOrdinal: ordinal, pickKey: 'reaction'},
      selected: 'chatChooseEmoji',
    }))
  }, [navigateAppend, onHidden, ordinal])

  let reactions = [...(_reactions?.keys() ?? [])]
    .map(emoji => ({
      emoji,
      users: [...(_reactions?.get(emoji)?.users ?? new Set())]
        // Earliest users go at the top
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(r => ({
          fullName: (_usersInfo.get(r.username) || {fullname: ''}).fullname || '',
          timestamp: r.timestamp,
          username: r.username,
        })),
    }))
    .sort(
      // earliest reactions go at the top
      (a, b) => (a.users[0]?.timestamp || 0) - (b.users[0]?.timestamp || 0)
    )
    // strip timestamp
    .map(e => ({
      emoji: e.emoji,
      users: e.users.map(u => ({
        fullName: u.fullName,
        username: u.username,
      })),
    }))
  if (!C.isMobile && emoji) {
    // Filter down to selected emoji
    reactions = reactions.filter(r => r.emoji === emoji)
  }
  const props = {
    attachmentRef,
    onAddReaction,
    onHidden,
    onMouseLeave,
    onMouseOver,
    ordinal,
    reactions,
    visible,
  }

  return <ReactionTooltipImpl {...props} />
}

const ReactionTooltipImpl = (props: Props) => {
  const insets = Kb.useSafeAreaInsets()
  const conversationIDKey = C.useChatContext(s => s.id)
  if (!props.visible) {
    return null
  }

  const sections = props.reactions.map(r => ({
    data: r.users.map(u => ({...u, key: `${u.username}:${r.emoji}`})),
    key: r.emoji,
    ordinal: props.ordinal,
    title: r.emoji,
  }))
  return (
    <Kb.Overlay
      attachTo={props.attachmentRef}
      onHidden={props.onHidden}
      position="top center"
      positionFallbacks={positionFallbacks}
      propagateOutsideClicks={true}
      style={styles.overlay}
    >
      {/* need context since this uses a portal... */}
      <C.ChatProvider id={conversationIDKey}>
        <OrdinalContext.Provider value={props.ordinal}>
          <Kb.Box2
            onMouseLeave={props.onMouseLeave}
            onMouseOver={props.onMouseOver}
            direction="vertical"
            gap="tiny"
            style={Kb.Styles.collapseStyles([styles.listContainer, {paddingBottom: insets.bottom}])}
          >
            {Kb.Styles.isMobile && (
              <Kb.Box2 direction="horizontal">
                <Kb.Text type="BodySemiboldLink" onClick={props.onHidden} style={styles.closeButton}>
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
              disableAbsoluteStickyHeader={true}
              contentContainerStyle={styles.list}
              renderItem={renderItem}
              renderSectionHeader={renderSectionHeader}
            />
            {Kb.Styles.isMobile && (
              <Kb.ButtonBar style={styles.addReactionButtonBar}>
                <Kb.Button
                  mode="Secondary"
                  fullWidth={true}
                  onClick={props.onAddReaction}
                  label="Add a reaction"
                >
                  <Kb.Icon
                    type="iconfont-reacji"
                    color={Kb.Styles.globalColors.blue}
                    style={styles.addReactionButtonIcon}
                  />
                </Kb.Button>
              </Kb.ButtonBar>
            )}
          </Kb.Box2>
        </OrdinalContext.Provider>
      </C.ChatProvider>
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
    data: Array<any>
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
      addReactionButtonIcon: {
        marginRight: Kb.Styles.globalMargins.tiny,
      },
      addReactionButtonText: {
        color: Kb.Styles.globalColors.black_50,
      },
      buttonContainer: {
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.white,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
        flexShrink: 0,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      closeButton: {
        padding: Kb.Styles.globalMargins.small,
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
        common: {
          backgroundColor: Kb.Styles.globalColors.white,
        },
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
