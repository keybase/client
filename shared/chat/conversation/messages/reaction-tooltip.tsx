import * as RouterConstants from '../../../constants/router2'
import * as Constants from '../../../constants/chat2'
import * as UsersConstants from '../../../constants/users'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../styles'
import ReactButton from './react-button/container'
import shallowEqual from 'shallowequal'
import type * as Types from '../../../constants/types/chat2'
import type * as UsersTypes from '../../../constants/types/users'
import {ConvoIDContext, OrdinalContext} from './ids-context'

export type Props = {
  attachmentRef?: () => React.Component<any> | null
  conversationIDKey: Types.ConversationIDKey
  onAddReaction: () => void
  onHidden: () => void
  onMouseLeave?: (syntheticEvent: React.SyntheticEvent) => void
  onMouseOver?: (syntheticEvent: React.SyntheticEvent) => void
  ordinal: Types.Ordinal
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
  attachmentRef?: any
  conversationIDKey: Types.ConversationIDKey
  emoji?: string
  onHidden: () => void
  onMouseLeave?: (syntheticEvent: React.SyntheticEvent) => void
  onMouseOver?: (syntheticEvent: React.SyntheticEvent) => void
  ordinal: Types.Ordinal
  visible: boolean
}

const emptyStateProps = {
  _reactions: new Map<string, Types.ReactionDesc>(),
  _usersInfo: new Map<string, UsersTypes.UserInfo>(),
}

const ReactionTooltip = (p: OwnProps) => {
  const {conversationIDKey, ordinal, onHidden, attachmentRef, onMouseLeave, onMouseOver, visible, emoji} = p

  const infoMap = UsersConstants.useState(s => s.infoMap)
  const {_reactions, good} = Constants.useContext(s => {
    const message = s.messageMap.get(ordinal)
    if (message && Constants.isMessageWithReactions(message)) {
      const _reactions = message.reactions
      return {_reactions, good: true}
    }
    return {...emptyStateProps, good: false}
  }, shallowEqual)
  const _usersInfo = good ? infoMap : emptyStateProps._usersInfo

  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onAddReaction = React.useCallback(() => {
    onHidden()
    navigateAppend({
      props: {conversationIDKey, onPickAddToMessageOrdinal: ordinal, pickKey: 'reaction'},
      selected: 'chatChooseEmoji',
    })
  }, [navigateAppend, onHidden, conversationIDKey, ordinal])

  let reactions = [..._reactions.keys()]
    .map(emoji => ({
      emoji,
      users: [...(_reactions.get(emoji)?.users ?? new Set())]
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
  if (!Container.isMobile && emoji) {
    // Filter down to selected emoji
    reactions = reactions.filter(r => r.emoji === emoji)
  }
  const props = {
    attachmentRef,
    conversationIDKey,
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
  if (!props.visible) {
    return null
  }

  const sections = props.reactions.map(r => ({
    conversationIDKey: props.conversationIDKey,
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
      positionFallbacks={['bottom center', 'left center']}
      propagateOutsideClicks={true}
      style={styles.overlay}
    >
      {/* need context since this uses a portal... */}
      <ConvoIDContext.Provider value={props.conversationIDKey}>
        <OrdinalContext.Provider value={props.ordinal}>
          <Kb.Box2
            onMouseLeave={props.onMouseLeave}
            onMouseOver={props.onMouseOver}
            direction="vertical"
            gap="tiny"
            style={Styles.collapseStyles([styles.listContainer, {paddingBottom: insets.bottom}])}
          >
            {Styles.isMobile && (
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
            {Styles.isMobile && (
              <Kb.ButtonBar style={styles.addReactionButtonBar}>
                <Kb.Button
                  mode="Secondary"
                  fullWidth={true}
                  onClick={props.onAddReaction}
                  label="Add a reaction"
                >
                  <Kb.Icon
                    type="iconfont-reacji"
                    color={Styles.globalColors.blue}
                    style={styles.addReactionButtonIcon}
                  />
                </Kb.Button>
              </Kb.ButtonBar>
            )}
          </Kb.Box2>
        </OrdinalContext.Provider>
      </ConvoIDContext.Provider>
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
    conversationIDKey: Types.ConversationIDKey
    data: Array<any>
    ordinal: Types.Ordinal
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addReactionButtonBar: {
        paddingBottom: Styles.globalMargins.medium,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
        paddingTop: Styles.globalMargins.small,
      },
      addReactionButtonIcon: {
        marginRight: Styles.globalMargins.tiny,
      },
      addReactionButtonText: {
        color: Styles.globalColors.black_50,
      },
      buttonContainer: {
        alignItems: 'center',
        backgroundColor: Styles.globalColors.white,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
        flexShrink: 0,
        paddingBottom: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.tiny,
      },
      closeButton: {
        padding: Styles.globalMargins.small,
      },
      emojiText: {
        color: Styles.globalColors.black_50,
        flex: -1,
      },
      list: Styles.platformStyles({
        isElectron: {
          flex: 1,
          paddingBottom: Styles.globalMargins.small,
        },
      }),
      listContainer: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.white,
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
      overlay: Styles.platformStyles({
        isElectron: {
          backgroundColor: Styles.globalColors.white,
          margin: Styles.globalMargins.tiny,
        },
      }),
      userContainer: {
        backgroundColor: Styles.globalColors.white,
        paddingBottom: Styles.globalMargins.xtiny,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
        paddingTop: Styles.globalMargins.xtiny,
      },
    }) as const
)

export default ReactionTooltip
