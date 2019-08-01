import * as React from 'react'
import * as Kb from '../../../common-adapters/mobile.native'
import * as Styles from '../../../styles'
import {Props} from '.'

const QRScan = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container}>
    {!props.waiting && (
      <Kb.QRScanner
        notAuthorizedView={<Kb.QRNotAuthorized />}
        onBarCodeRead={data => props.onSubmitTextCode(data)}
        style={styles.camera}
      />
    )}
    {!props.waiting && <Kb.QRLines canScan={true} />}
    {props.waiting && <Kb.ProgressIndicator style={styles.waiting} type="Large" white={true} />}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  camera: {
    flexGrow: 1,
  },
  container: {
    alignSelf: 'stretch',
    backgroundColor: Styles.globalColors.black,
    height: 200,
    overflow: 'hidden',
    position: 'relative',
  },
  waiting: {
    ...Styles.globalStyles.fillAbsolute,
  },
})

export default QRScan
