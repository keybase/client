import * as Kb from '@/common-adapters'
import * as QR from '@/common-adapters/qr.native'
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  camera: {
    flexGrow: 1,
  },
  container: {
    alignSelf: 'stretch',
    backgroundColor: Kb.Styles.globalColors.black,
    height: 160,
    overflow: 'hidden',
    position: 'relative',
  },
  waiting: {
    ...Kb.Styles.globalStyles.fillAbsolute,
  },
}))

export default QRScan
