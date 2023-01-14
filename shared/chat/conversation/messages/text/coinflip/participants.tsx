import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import type * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'

export type Props = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  participants?: Array<RPCChatTypes.UICoinFlipParticipant>
  visible: boolean
}

const items: Kb.MenuItems = []

const CoinFlipParticipants = (props: Props) => {
  const {attachTo, onHidden, participants, visible} = props
  const header = (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="vertical" centerChildren={true} style={styles.container}>
        <Kb.Text type="BodySmall">{participants?.length ?? 0} participants</Kb.Text>
      </Kb.Box2>
      <Kb.Divider />
      <Kb.ScrollView style={styles.partContainer}>
        {participants?.map(p => (
          <Kb.NameWithIcon
            colorBroken={true}
            colorFollowing={true}
            key={`${p.username}${p.deviceName}`}
            horizontal={true}
            username={p.username}
            metaOne={p.deviceName}
            containerStyle={styles.participants}
          />
        )) ?? null}
      </Kb.ScrollView>
      <Kb.Divider />
      <Kb.Box2 direction="vertical" style={styles.container} centerChildren={true}>
        <Kb.Text type="BodySmallPrimaryLink" onClickURL="https://keybase.io/coin-flip">
          How this works
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )

  return (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      header={header}
      items={items}
      onHidden={onHidden}
      visible={visible}
    />
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
    } as const)
)

export default CoinFlipParticipants
