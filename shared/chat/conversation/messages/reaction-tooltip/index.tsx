import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import ReactButton from '../react-button/container'

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

const ReactionTooltip = (props: Props) => {
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
      <Kb.Box2
        onMouseLeave={props.onMouseLeave}
        onMouseOver={props.onMouseOver}
        direction="vertical"
        gap="tiny"
        style={styles.listContainer}
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
          style={styles.list}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
        />
        {Styles.isMobile && (
          <Kb.ButtonBar style={styles.addReactionButtonBar}>
            <Kb.Button mode="Secondary" fullWidth={true} onClick={props.onAddReaction} label="Add a reaction">
              <Kb.Icon
                type="iconfont-reacji"
                color={Styles.globalColors.blue}
                style={Kb.iconCastPlatformStyles(styles.addReactionButtonIcon)}
              />
            </Kb.Button>
          </Kb.ButtonBar>
        )}
      </Kb.Box2>
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
    <ReactButton
      conversationIDKey={section.conversationIDKey}
      ordinal={section.ordinal}
      emoji={section.title}
    />
    <Kb.Text type="Terminal" lineClamp={1} style={styles.emojiText}>
      {section.title}
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
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
})

export default ReactionTooltip
