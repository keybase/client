import * as Kb from '../../../common-adapters/mobile.native'
import * as QR from '../../../common-adapters/qr.native'
import * as Styles from '../../../styles'
import type {Props} from '.'

const QRScan = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container}>
    {!props.waiting && (
      <QR.QRScanner
        notAuthorizedView={<QR.QRNotAuthorized />}
        onBarCodeRead={data => props.onSubmitTextCode(data)}
        style={styles.camera}
      />
    )}
    {!props.waiting && <QR.QRLines canScan={true} />}
    {props.waiting && <Kb.ProgressIndicator style={styles.waiting} type="Large" white={true} />}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  camera: {
    flexGrow: 1,
  },
  container: {
    alignSelf: 'stretch',
    backgroundColor: Styles.globalColors.black,
    height: 160,
    overflow: 'hidden',
    position: 'relative',
  },
  waiting: {
    ...Styles.globalStyles.fillAbsolute,
  },
}))

export default QRScan
