// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box2, ClickableBox, Icon, NameWithIcon, Overlay, SectionList, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, isMobile, platformStyles, styleSheetCreate} from '../../../../styles'
import ReactButton from '../react-button/container'

export type Props = {|
  attachmentRef?: () => ?React.Component<any>,
  conversationIDKey: Types.ConversationIDKey,
  onAddReaction: () => void,
  onHidden: () => void,
  onMouseLeave?: (SyntheticEvent<Element>) => void,
  onMouseOver?: (SyntheticEvent<Element>) => void,
  ordinal: Types.Ordinal,
  reactions: Array<{
    emoji: string,
    users: Array<{fullName: string, username: string}>,
  }>,
  visible: boolean,
|}

export const ReactionTooltip = (props: Props) => {
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
    <Overlay
      attachTo={props.attachmentRef}
      onHidden={props.onHidden}
      position="top center"
      positionFallbacks={['bottom center', 'left center']}
      propagateOutsideClicks={true}
      style={styles.overlay}
    >
      <Box2
        onMouseLeave={props.onMouseLeave}
        onMouseOver={props.onMouseOver}
        direction="vertical"
        gap="tiny"
        style={styles.listContainer}
      >
        {isMobile && (
          <Box2 direction="horizontal">
            <Text type="BodySemiboldLink" onClick={props.onHidden} style={styles.closeButton}>
              Close
            </Text>
            <Box2 direction="horizontal" style={{flex: 1}} />
          </Box2>
        )}
        <SectionList
          alwaysBounceVertical={false}
          initialNumToRender={19} // Keeps height from trashing on mobile
          sections={sections}
          stickySectionHeadersEnabled={true}
          style={styles.list}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
        />
        {isMobile && (
          <ClickableBox onClick={props.onAddReaction}>
            <Box2 centerChildren={true} direction="horizontal" gap="xtiny" style={styles.addReactionButton}>
              <Icon type="iconfont-reacji" color={globalColors.black_40} fontSize={22} />
              <Text type="BodySemibold" style={styles.addReactionButtonText}>
                Add a reaction
              </Text>
            </Box2>
          </ClickableBox>
        )}
      </Box2>
    </Overlay>
  )
}

type ListItem = {fullName: string, key: string, username: string}

const renderItem = ({item}: {item: ListItem}) => {
  return (
    <NameWithIcon
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
    conversationIDKey: Types.ConversationIDKey,
    data: Array<any>,
    ordinal: Types.Ordinal,
    title: string,
  },
}) => (
  <Box2
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
    <Text type="Terminal" lineClamp={1} style={styles.emojiText}>
      {section.title}
    </Text>
  </Box2>
)

const styles = styleSheetCreate({
  addReactionButton: {
    borderColor: globalColors.black_10,
    borderRadius: 20,
    borderStyle: 'solid',
    borderWidth: 2,
    height: 40,
    marginBottom: globalMargins.large,
    marginLeft: globalMargins.large,
    marginRight: globalMargins.large,
    marginTop: globalMargins.xtiny,
    paddingLeft: globalMargins.large,
    paddingRight: globalMargins.large,
  },
  addReactionButtonText: {
    color: globalColors.black_40,
  },
  buttonContainer: {
    alignItems: 'center',
    backgroundColor: globalColors.white,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    flexShrink: 0,
    paddingBottom: globalMargins.tiny,
    paddingTop: globalMargins.tiny,
  },
  closeButton: {
    padding: globalMargins.small,
  },
  emojiText: {
    color: globalColors.black_40,
    flex: -1,
  },
  list: platformStyles({
    isElectron: {
      paddingBottom: globalMargins.small,
    },
  }),
  listContainer: platformStyles({
    common: {
      backgroundColor: globalColors.white,
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
  overlay: platformStyles({
    isElectron: {
      margin: globalMargins.tiny,
    },
  }),
  userContainer: {
    backgroundColor: globalColors.white,
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.tiny + globalMargins.medium,
    paddingRight: globalMargins.tiny,
    paddingTop: globalMargins.xtiny,
  },
})

export default ReactionTooltip
