import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'

export type Props = {
  attachTo?: React.RefObject<Kb.MeasureRef>
  onHidden: () => void
  participants?: ReadonlyArray<T.RPCChat.UICoinFlipParticipant>
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          paddingBottom: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.xtiny,
          paddingTop: Kb.Styles.globalMargins.xsmall,
        },
      }),
      partContainer: {
        maxHeight: 200,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
      },
      participants: {
        marginBottom: Kb.Styles.globalMargins.tiny,
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      title: Kb.Styles.platformStyles({
        isElectron: {
          paddingTop: Kb.Styles.globalMargins.xtiny,
        },
      }),
    }) as const
)

export default CoinFlipParticipants
