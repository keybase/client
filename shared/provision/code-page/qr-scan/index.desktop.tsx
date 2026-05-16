import * as Kb from '@/common-adapters'
import QRLines from '@/provision/code-page/qr-scan/lines'
import useQR from '@/provision/code-page/qr-scan/hooks'

// Basically only used for storybook

const QRScan = () => {
  const {waiting} = useQR()
  return (
    <Kb.Box2 direction="vertical" justifyContent="center" relative={true} style={styles.container}>
      <QRLines canScan={true} />
      {waiting && <Kb.ProgressIndicator style={styles.waiting} type="Large" white={true} />}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignSelf: 'stretch',
        backgroundColor: Kb.Styles.globalColors.black,
        height: 200,
      },
      waiting: {
        alignSelf: 'center',
      },
    }) as const
)

export default QRScan
