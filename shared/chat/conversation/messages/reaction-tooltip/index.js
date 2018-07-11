// @flow
import * as React from 'react'
import * as MessageTypes from '../../../../constants/types/chat2/message'
import {Box2, ClickableBox, Icon, NameWithIcon, Overlay, SectionList, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, isMobile, platformStyles, styleSheetCreate} from '../../../../styles'
import ReactButton from '../react-button/container'

type Props = {
  attachmentRef?: ?React.Component<any, any>,
  messageID: MessageTypes.MessageID,
  onAddReaction: () => void,
  onHidden: () => void,
  onReact: string => void,
  reactions: Array<{
    emoji: string,
    users: Array<{fullName: string, username: string}>,
  }>,
}

const ReactionTooltip = (props: Props) => {
  const sections = props.reactions.map(r => ({
    data: r.users.map(u => ({...u, key: `${u.username}`})),
    key: r.emoji,
    messageID: props.messageID,
    title: r.emoji,
  }))
  return (
    <Overlay attachTo={props.attachmentRef} onHidden={props.onHidden} position="top right">
      <Box2 direction="vertical" gap="tiny" style={styles.listContainer}>
        {isMobile && (
          <Box2 direction="horizontal">
            <Text type="BodySemiboldLink" onClick={props.onHidden} style={styles.closeButton}>
              Close
            </Text>
            <Box2 direction="horizontal" style={{flex: 1}} />
          </Box2>
        )}
        <SectionList sections={sections} renderItem={renderItem} renderSectionHeader={renderSectionHeader} />
        {isMobile && (
          <ClickableBox onClick={props.onAddReaction}>
            <Box2 centerChildren={true} direction="horizontal" gap="xtiny" style={styles.addReactionButton}>
              <Icon type="iconfont-reacji" color={globalColors.black_40} fontSize={22} />{' '}
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
  section: {data: Array<any>, messageID: MessageTypes.MessageID, title: string},
}) => (
  <Box2
    key={section.title}
    direction="horizontal"
    gap="tiny"
    gapStart={true}
    fullWidth={true}
    style={styles.buttonContainer}
  >
    <ReactButton messageID={section.messageID} emoji={section.title} />
    <Text type="Terminal" style={styles.emojiText}>
      {section.title}
    </Text>
  </Box2>
)

const styles = styleSheetCreate({
  addReactionButton: {
    borderColor: globalColors.black_05,
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
    flexShrink: 0,
    paddingBottom: globalMargins.tiny,
    paddingTop: globalMargins.tiny,
  },
  closeButton: {
    padding: globalMargins.small,
  },
  emojiText: {
    color: globalColors.black_40,
  },
  listContainer: platformStyles({
    isElectron: {
      maxHeight: 320,
      width: 240,
    },
    isMobile: {
      backgroundColor: globalColors.white,
      maxHeight: '90%',
      width: '100%',
    },
  }),
  userContainer: {
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.tiny + globalMargins.medium,
    paddingRight: globalMargins.tiny,
    paddingTop: globalMargins.xtiny,
  },
})

export default ReactionTooltip
