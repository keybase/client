// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {RNCamera} from 'react-native-camera'
import type {Props} from '.'

const QRScan = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
    <Kb.Text type="BodyBigLink" style={styles.cancel} onClick={() => props.onSubmitCode()}>
      Cancel
    </Kb.Text>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.topContainer} gap="small">
      <Kb.Box2 direction="vertical" style={styles.cameraContainer}>
        <RNCamera
          type={RNCamera.Constants.Type.back}
          autoFocus={RNCamera.Constants.AutoFocus.on}
          captureAudio={false}
          flashMode={RNCamera.Constants.FlashMode.off}
          permissionDialogTitle={'Permission to use camera'}
          permissionDialogMessage={'We need access to your camera to scan in the stellar key'}
          notAuthorizedView={<Kb.QRNotAuthorized />}
          onBarCodeRead={({data}) => props.onSubmitCode(data)}
          barCodeTypes={[RNCamera.Constants.BarCodeType.qr]}
          style={styles.camera}
        />
        <Kb.QRLines canScan={true} color={Styles.globalColors.purple3} />
      </Kb.Box2>
      <Kb.Text type="BodySemibold" style={styles.text}>
        Scan a Stellar QR code.
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.bottomContainer} gap="small">
      <Kb.InfoNote color={Styles.globalColors.white_20} />
      <Kb.Text type="BodySmall" style={styles.text}>
        You can find your own QR code by tapping the 'Receive' button on your account page.
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  text: {
    color: Styles.globalColors.white,
    textAlign: 'center',
  },
  topContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  bottomContainer: {
    paddingLeft: Styles.globalMargins.large,
    paddingRight: Styles.globalMargins.large,
    paddingBottom: Styles.globalMargins.xlarge,
  },
  cancel: {
    alignSelf: 'flex-start',
    color: Styles.globalColors.white,
    paddingBottom: 8,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: 8,
    minHeight: Styles.globalMargins.xlarge - Styles.statusBarHeight,
  },
  header: {
    backgroundColor: Styles.globalColors.transparent,
    width: '100%',
  },
  camera: {
    width: '100%',
    height: '100%',
    alignSelf: 'center',
  },
  container: {
    backgroundColor: Styles.globalColors.purple,
    alignItems: 'center',
  },
  cameraContainer: {
    alignSelf: 'center',
    backgroundColor: Styles.globalColors.black_75,
    borderStyle: 'solid',
    borderColor: Styles.globalColors.purple3,
    borderRadius: Styles.borderRadius,
    borderWidth: 4,
    height: 200,
    overflow: 'hidden',
    position: 'relative',
    width: 200,
  },
})

export default QRScan
