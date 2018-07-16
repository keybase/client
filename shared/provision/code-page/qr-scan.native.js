// @flow
import * as React from 'react'
import {RNCamera} from 'react-native-camera'
import {Text, Box2, Icon} from '../../common-adapters'
import {globalColors, styleSheetCreate} from '../../styles'
import QRScanLines from './qr-scan-lines'

const NotAuthorized = ({onOpenSettings}) => (
  <Box2 direction="vertical">
    <Icon type="icon-access-denied-266" />
    <Text type="BodyTiny">
      You need to allow access to the camera.
      <Text type="BodyTiny" onClick={onOpenSettings}>
        Open settings
      </Text>
    </Text>
  </Box2>
)

const QRScan = (props: Props) => (
  <Box2 direction="vertical" style={styles.container}>
    <RNCamera
      type={RNCamera.Constants.Type.back}
      autoFocus={RNCamera.Constants.AutoFocus.on}
      captureAudio={false}
      flashMode={RNCamera.Constants.FlashMode.off}
      permissionDialogTitle={'Permission to use camera'}
      permissionDialogMessage={'We need access to your camera to scan in the secret code'}
      notAuthorizedView={<NotAuthorized onOpenSettings={props.onOpenSettings} />}
      onBarCodeRead={({data}) => props.onScan(data)}
      barCodeTypes={[RNCamera.Constants.BarCodeType.qr]}
      style={styles.camera}
    />

    <QRScanLines canScan={true} />
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
    position: 'relative',
  },
})

export default QRScan
