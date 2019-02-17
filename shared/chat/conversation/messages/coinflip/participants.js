// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

type Props = {
  attachTo: () => ?React.Component<any>,
  onHidden: () => void,
  participants: Array<RPCChatTypes.UICoinFlipParticipant>,
  visible: boolean,
}

const items = []

const CoinFlipParticipants = (props: Props) => {
  const header = {
    title: 'header',
    view: (
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.container}>
        <Kb.Box2 direction="vertical">
          <Kb.Text type="Body" style={styles.partHeading}>
            Participants
          </Kb.Text>
          <Kb.Text type="BodySmall" style={styles.partHeading}>
            {props.participants.length} total
          </Kb.Text>
        </Kb.Box2>
        <Kb.Divider />
        <Kb.ScrollView style={styles.partContainer}>
          {props.participants.map(p => (
            <Kb.NameWithIcon
              key={`${p.username}${p.deviceName}`}
              horizontal={true}
              username={p.username}
              metaOne={p.deviceName}
            />
          ))}
        </Kb.ScrollView>
      </Kb.Box2>
    ),
  }
  return (
    <Kb.FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={true}
      header={header}
      items={items}
      onHidden={props.onHidden}
      visible={props.visible}
    />
  )
}

const styles = Styles.styleSheetCreate({
  container: {
    paddingTop: Styles.globalMargins.tiny,
  },
  partContainer: {
    maxHeight: 200,
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
  },
  partHeading: {
    alignSelf: 'center',
  },
})

export default CoinFlipParticipants
