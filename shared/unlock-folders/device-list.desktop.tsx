import * as Kb from '@/common-adapters'
import type {UnlockFolderDevice} from './store'

export type Props = {
  devices: ReadonlyArray<UnlockFolderDevice>
  toPaperKeyInput: () => void
}

const DeviceRow = ({device}: {device: UnlockFolderDevice}) => {
  const icon = (
    {
      backup: 'icon-paper-key-32',
      desktop: 'icon-computer-32',
      mobile: 'icon-phone-32',
    } as const
  )[device.type]

  return (
    <Kb.Box2 direction="horizontal" style={styles.deviceRow}>
      <Kb.Box2 direction="horizontal" alignItems="center" justifyContent="center" style={styles.iconWrapper}>
        <Kb.ImageIcon type={icon} style={{height: 22}} />
      </Kb.Box2>
      <Kb.Text type="BodySemibold" style={styles.deviceName}>
        {device.name}
      </Kb.Text>
    </Kb.Box2>
  )
}

const DeviceList = (props: Props) => (
  <Kb.Box2 direction="vertical" alignItems="center">
    <Kb.Text center={true} type="Body" style={styles.infoText}>
      This computer and possibly others are unable to read some of your folders. To avoid losing data forever,
      please turn on one of the devices below:
    </Kb.Text>
    <Kb.Box2 direction="vertical" style={styles.devicesContainer}>
      {props.devices.map(d => (
        <DeviceRow key={d.deviceID} device={d} />
      ))}
    </Kb.Box2>
    <Kb.Box2 direction="horizontal" style={styles.buttonsContainer}>
      <Kb.Button
        type="Dim"
        label="Enter a paper key instead"
        style={styles.enterPaperKey}
        onClick={props.toPaperKeyInput}
      />
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      buttonsContainer: {
        alignSelf: 'center',
        marginRight: 30,
        marginTop: Kb.Styles.globalMargins.small,
      },
      deviceName: {marginLeft: 16},
      deviceRow: {marginBottom: 16},
      devicesContainer: Kb.Styles.platformStyles({
        isElectron: {
          alignSelf: 'center',
          backgroundColor: Kb.Styles.globalColors.greyLight,
          height: 162,
          overflowY: 'auto',
          ...Kb.Styles.paddingV(Kb.Styles.globalMargins.small),
          scrollbarGutter: 'stable',
          width: 440,
        },
      }),
      enterPaperKey: {
        height: 32,
        marginRight: 7,
        width: 236,
      },
      iconWrapper: {
        marginLeft: 33,
        width: 24,
      },
      infoText: {
        marginBottom: 8,
        marginTop: 5,
        ...Kb.Styles.paddingH(55),
      },
    }) as const
)

export default DeviceList
