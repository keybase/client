import * as React from 'react'
import {
  Box2,
  ProgressIndicator,
  QRLines,
  QRNotAuthorized,
  QRScanner,
} from '../../../common-adapters/mobile.native'
import {globalColors, styleSheetCreate, globalStyles} from '../../../styles'
import {BarCodeScanner} from 'expo-barcode-scanner'
import {Props} from '.'

const QRScan = (props: Props) => (
  <Box2 direction="vertical" style={styles.container}>
    {!props.waiting && (
      <QRScanner
        notAuthorizedView={<QRNotAuthorized />}
        onBarCodeRead={data => props.onSubmitTextCode(data)}
        style={styles.camera}
      />
    )}
    {!props.waiting && <QRLines canScan={true} />}
    {props.waiting && <ProgressIndicator style={styles.waiting} type="Large" white={true} />}
  </Box2>
)

const styles = styleSheetCreate({
  camera: {
    flexGrow: 1,
  },
  container: {
    alignSelf: 'stretch',
    backgroundColor: globalColors.black,
    height: 200,
    overflow: 'hidden',
    position: 'relative',
  },
  waiting: {
    ...globalStyles.fillAbsolute,
  },
})

export default QRScan
