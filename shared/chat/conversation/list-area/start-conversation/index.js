// @flow
import * as React from 'react'
import {Box2, Text, Button, Icon} from '../../../../common-adapters'
import {styleSheetCreate, platformStyles, globalColors, globalMargins} from '../../../../styles'

type Props = {
  isLoading: boolean,
  onStart: () => void,
  participants: string,
  showAddParticipants: boolean,
}

const StartConversation = (props: Props) => (
  <Box2 direction="vertical" style={styles.container} gap="small" gapStart={true} gapEnd={true}>
    <Text type="BodySmall" style={styles.header}>
      You haven't chatted with {props.participants} yet.
    </Text>
    <Button type="Primary" label="Start chatting" onClick={props.onStart} waiting={props.isLoading}>
      <Icon
        type="iconfont-chat"
        style={{
          marginRight: 8,
        }}
        color={globalColors.white}
      />
    </Button>
    {props.showAddParticipants && <Text type="BodySmall">or add more participants.</Text>}
  </Box2>
)

const styles = styleSheetCreate({
  arrow: platformStyles({
    common: {
      fontSize: 30,
      lineHeight: 40,
    },
  }),
  container: {
    alignItems: 'center',
    backgroundColor: globalColors.white,
    flex: 1,
    justifyContent: 'center',
    padding: 8,
    width: '100%',
  },
  header: {
    marginLeft: globalMargins.medium,
    marginRight: globalMargins.medium,
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
})

export default StartConversation
