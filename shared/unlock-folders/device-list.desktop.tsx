import type * as C from '@/constants'
import * as Kb from '@/common-adapters'

export type Props = {
  devices: C.ConfigStore['unlockFoldersDevices']
  toPaperKeyInput: () => void
}
type Device = C.ConfigStore['unlockFoldersDevices'][0]

const DeviceRow = ({device}: {device: Device}) => {
  const icon = (
    {
      backup: 'icon-paper-key-32',
      desktop: 'icon-computer-32',
      mobile: 'icon-phone-32',
    } as const
  )[device.type]

  return (
    <div style={{...Kb.Styles.globalStyles.flexBoxRow, marginBottom: 16}}>
      <div style={styles.iconWrapper}>
        <Kb.Icon type={icon} style={{height: 22}} />
      </div>
      <Kb.Text type="BodySemibold" style={{marginLeft: 16}}>
        {device.name}
      </Kb.Text>
    </div>
  )
}

const DeviceList = (props: Props) => (
  <div style={{...Kb.Styles.globalStyles.flexBoxColumn, alignItems: 'center'}}>
    <Kb.Text center={true} type="Body" style={styles.infoText}>
      This computer and possibly others are unable to read some of your folders. To avoid losing data forever,
      please turn on one of the devices below:
    </Kb.Text>
    <div style={Kb.Styles.collapseStylesDesktop([styles.devicesContainer])}>
      {props.devices.map(d => (
        <DeviceRow key={d.deviceID} device={d} />
      ))}
    </div>
    <div style={styles.buttonsContainer}>
      <Kb.Button
        type="Dim"
        label="Enter a paper key instead"
        style={styles.enterPaperKey}
        onClick={props.toPaperKeyInput}
      />
    </div>
  </div>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      accessFolders: {marginRight: 0},
      buttonsContainer: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignSelf: 'center',
        marginRight: 30,
        marginTop: Kb.Styles.globalMargins.small,
      },
      devicesContainer: Kb.Styles.platformStyles({
        isElectron: {
          alignSelf: 'center',
          backgroundColor: Kb.Styles.globalColors.greyLight,
          height: 162,
          overflowY: 'scroll',
          paddingBottom: Kb.Styles.globalMargins.small,
          paddingTop: Kb.Styles.globalMargins.small,
          width: 440,
        },
      }),
      enterPaperKey: {
        height: 32,
        marginRight: 7,
        width: 236,
      },
      iconWrapper: {
        display: 'flex',
        justifyContent: 'center',
        marginLeft: 33,
        width: 24,
      },
      infoText: {
        marginBottom: 8,
        marginTop: 5,
        paddingLeft: 55,
        paddingRight: 55,
      },
    }) as const
)

export default DeviceList
