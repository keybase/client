import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

export type Props = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  participants: Array<RPCChatTypes.UICoinFlipParticipant>
  visible: boolean
}

const items = []

const CoinFlipParticipants = (props: Props) => {
  const header = {
    title: 'header',
    view: (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Box2 direction="vertical" centerChildren={true} style={styles.container}>
          <Kb.Text type="BodySmall">{props.participants.length} participants</Kb.Text>
        </Kb.Box2>
        <Kb.Divider />
        <Kb.ScrollView style={styles.partContainer}>
          {props.participants.map(p => (
            <Kb.NameWithIcon
              colorBroken={true}
              colorFollowing={true}
              key={`${p.username}${p.deviceName}`}
              horizontal={true}
              username={p.username}
              metaOne={p.deviceName}
              containerStyle={styles.participants}
            />
          ))}
        </Kb.ScrollView>
        <Kb.Divider />
        <Kb.Box2 direction="vertical" style={styles.container} centerChildren={true}>
          <Kb.Text type="BodySmallPrimaryLink" onClickURL="https://keybase.io/coin-flip">
            How this works
          </Kb.Text>
        </Kb.Box2>
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
  container: Styles.platformStyles({
    isElectron: {
      paddingBottom: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.xtiny,
      paddingTop: Styles.globalMargins.xsmall,
    },
  }),
  partContainer: {
    maxHeight: 200,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  participants: {
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
  title: Styles.platformStyles({
    isElectron: {
      paddingTop: Styles.globalMargins.xtiny,
    },
  }),
})

export default CoinFlipParticipants
