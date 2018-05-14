// @flow
import * as React from 'react'
import {Box2, Text, Button} from '../../../../common-adapters'
import {styleSheetCreate, platformStyles} from '../../../../styles'

type Props = {
  participants: string,
  onStart: () => void,
}

const StartConversation = (props: Props) => (
  <Box2 direction="vertical" style={styles.container} gap="small" gapStart={true} gapEnd={true}>
    <Text type="Body" style={styles.header}>
      You don't have a conversation with {props.participants} yet.
    </Text>
    <Text type="Body" style={styles.header}>
      Start an end-to-end encrypted chat?
    </Text>
    <Box2 direction="vertical" style={styles.spacer} />
    <Text type="BodySmall" style={styles.addMore}>
      (or add some more participants{' '}
      <Text type="Header" style={styles.arrow}>
        ☝️
      </Text>)
    </Text>
    <Button type="Primary" label="Do it!" onClick={props.onStart} />
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
    height: '80%',
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
