import * as Kb from '@/common-adapters'
import QRLines from '@/common-adapters/qr-lines'
import type {Props} from '.'
// Basically only used for storybook

const QRScan = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container}>
    <QRLines canScan={true} />
    {props.waiting && <Kb.ProgressIndicator style={styles.waiting} type="Large" white={true} />}
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignSelf: 'stretch',
        backgroundColor: Kb.Styles.globalColors.black,
        height: 200,
        justifyContent: 'center',
        position: 'relative',
      },
      waiting: {
        alignSelf: 'center',
      },
    }) as const
)

export default QRScan
