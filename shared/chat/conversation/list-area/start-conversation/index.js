// @flow
import * as React from 'react'
import {Box2, Text, Button, Icon} from '../../../../common-adapters'
import {styleSheetCreate, platformStyles, globalColors} from '../../../../styles'

type Props = {
  participants: string,
  onStart: () => void,
}

const StartConversation = (props: Props) => (
  <Box2 direction="vertical" style={styles.container} gap="small" gapStart={true} gapEnd={true}>
    <Text type="BodySemibold" style={styles.header}>
      You don't have a conversation with {props.participants} yet.
    </Text>
    <Button type="Primary" label="Start an end-to-end encrypted chat" onClick={props.onStart}>
      <Icon
        type="iconfont-chat"
        style={{
          marginRight: 8,
        }}
        color={globalColors.white}
      />
    </Button>
    <Text type="BodySmall" style={styles.addMore}>
      (or add some more participants)
    </Text>
  </Box2>
)

const styles = styleSheetCreate({
  addMore: platformStyles({
    common: {
      lineHeight: 40,
    },
  }),
  arrow: platformStyles({
    common: {
      fontSize: 30,
      lineHeight: 40,
    },
  }),
  container: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    padding: 8,
    width: '100%',
  },
  header: {
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
})

export default StartConversation
