// @flow
import * as React from 'react'
import * as MessageTypes from '../../../../constants/types/chat2/message'
import {Box2, NameWithIcon, Overlay, SectionList, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, platformStyles, styleSheetCreate} from '../../../../styles'
import ReactButton from '../react-button/container'

type Props = {
  attachmentRef?: ?React.Component<any, any>,
  messageID: MessageTypes.MessageID,
  onHidden: () => void,
  onReact: string => void,
  reactions: Array<{
    emoji: string,
    users: Array<{fullName: string, username: string}>,
  }>,
}

const ReactionTooltip = (props: Props) => {
  const sections = props.reactions.map(r => ({
    messageID: props.messageID,
    data: r.users,
    title: r.emoji,
  }))
  return (
    <Overlay attachTo={props.attachmentRef} onHidden={props.onHidden} position="top right">
      <Box2 direction="vertical" gap="tiny" style={styles.listContainer}>
        <SectionList sections={sections} renderItem={renderItem} renderSectionHeader={renderSectionHeader} />
      </Box2>
    </Overlay>
  )
}

type ListItem = {fullName: string, username: string}

const renderItem = ({item}: {item: ListItem}) => {
  return (
    <NameWithIcon
      key={item.username}
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
  buttonContainer: {
    alignItems: 'center',
    backgroundColor: globalColors.white,
    flexShrink: 0,
    paddingBottom: globalMargins.tiny,
    paddingTop: globalMargins.tiny,
  },
  emojiText: {
    color: globalColors.black_40,
  },
  listContainer: platformStyles({
    common: {
      maxHeight: 320,
    },
    isElectron: {
      width: 240,
    },
    isMobile: {
      backgroundColor: globalColors.white,
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
