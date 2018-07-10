// @flow
import * as React from 'react'
import * as MessageTypes from '../../../../constants/types/chat2/message'
import {Box2, FloatingBox, NameWithIcon, List, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, styleSheetCreate} from '../../../../styles'
import ReactButton from '../react-button/container'

type Props = {
  attachmentRef?: ?React.Component<any, any>,
  messageID: MessageTypes.MessageID,
  onHidden: () => void,
  onReact: string => void,
  emoji: string,
  users: Array<{fullName: string, username: string}>,
}

const ReactionTooltip = (props: Props) => {
  return (
    <FloatingBox attachTo={props.attachmentRef} onHidden={props.onHidden} position="top right">
      <Box2 direction="vertical" gap="tiny" gapStart={true} style={{maxHeight: 320}}>
        <Box2
          direction="horizontal"
          gap="tiny"
          gapStart={true}
          fullWidth={true}
          style={styles.buttonContainer}
        >
          <ReactButton messageID={props.messageID} emoji={props.emoji} />
          <Text type="Terminal" style={styles.emojiText}>
            {props.emoji}
          </Text>
        </Box2>
        <List style={{height: 320, width: 240}} items={props.users} renderItem={renderItem} />
      </Box2>
    </FloatingBox>
  )
}

type ListItem = {fullName: string, username: string}

const renderItem = (_, item: ListItem) => {
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

const styles = styleSheetCreate({
  buttonContainer: {
    alignItems: 'center',
  },
  emojiText: {
    color: globalColors.black_40,
  },
  userContainer: {
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.tiny + globalMargins.medium,
    paddingRight: globalMargins.tiny,
    paddingTop: globalMargins.xtiny,
  },
})

export default ReactionTooltip
