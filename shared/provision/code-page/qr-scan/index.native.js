// @flow
import * as React from 'react'
import {RNCamera} from 'react-native-camera'
import {Box2, ProgressIndicator} from '../../../common-adapters'
import {globalColors, styleSheetCreate, globalStyles} from '../../../styles'
import QRScanLines from './lines'
import QRScanNotAuthorized from './not-authorized'
import type {Props} from '.'

const QRScan = (props: Props) => (
  <Box2 direction="vertical" style={styles.container}>
    <RNCamera
      key={props.mountKey}
      type={RNCamera.Constants.Type.back}
      autoFocus={RNCamera.Constants.AutoFocus.on}
      captureAudio={false}
      flashMode={RNCamera.Constants.FlashMode.off}
      permissionDialogTitle={'Permission to use camera'}
      permissionDialogMessage={'We need access to your camera to scan in the secret code'}
      notAuthorizedView={<QRScanNotAuthorized onOpenSettings={props.onOpenSettings} />}
      onBarCodeRead={({data}) => props.onSubmitTextCode(data)}
      barCodeTypes={[RNCamera.Constants.BarCodeType.qr]}
      style={styles.camera}
    />
    <QRScanLines canScan={true} />
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
