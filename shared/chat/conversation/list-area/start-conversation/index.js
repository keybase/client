// @flow
import * as React from 'react'
import {Box2, Text, Button, Icon} from '../../../../common-adapters'
import {styleSheetCreate, platformStyles, globalColors, globalMargins} from '../../../../styles'

type Props = {
  isError: boolean,
  isLoading: boolean,
  onStart: () => void,
  participants: string,
  showAddParticipants: boolean,
}

const StartConversation = (props: Props) => (
  <Box2 direction="vertical" style={styles.container} gap="small" gapStart={true} gapEnd={true}>
    <Text center={true} type="BodySmall" style={styles.header}>
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
    {props.isError && (
      <React.Fragment>
        <Text style={styles.error} type="Body">
          An error occurred while creating the conversation, please try again.
        </Text>
        <Text style={styles.error} type="Body">
          If the problem persists, please send us feedback.
        </Text>
      </React.Fragment>
    )}
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
  error: { color: globalColors.red },
  header: {
    marginLeft: globalMargins.medium,
    marginRight: globalMargins.medium,
  },
  spacer: { flex: 1 },
})

export default StartConversation
