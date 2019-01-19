// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {RNCamera} from 'react-native-camera'
import type {Props} from '.'

const QRScan = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
    <Kb.SafeAreaViewTop style={styles.safeAreaViewTop} />
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
      <Kb.Text center={true} type="BodySemibold" style={styles.text}>
        Scan a Stellar QR code.
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.bottomContainer} gap="small">
      <Kb.InfoNote color={Styles.globalColors.white_20} />
      <Kb.Text center={true} type="BodySmall" style={styles.text}>
        You can find your own QR code by tapping the 'Receive' button on your account page.
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  bottomContainer: {
    paddingBottom: Styles.globalMargins.xlarge,
    paddingLeft: Styles.globalMargins.large,
    paddingRight: Styles.globalMargins.large,
  },
  camera: {
    alignSelf: 'center',
    height: '100%',
    width: '100%',
  },
  cameraContainer: {
    alignSelf: 'center',
    backgroundColor: Styles.globalColors.black_75,
    borderColor: Styles.globalColors.purple3,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 4,
    height: 200,
    overflow: 'hidden',
    position: 'relative',
    width: 200,
  },
  cancel: {
    alignSelf: 'flex-start',
    color: Styles.globalColors.white,
    minHeight: Styles.globalMargins.xlarge - Styles.statusBarHeight,
    paddingBottom: 8,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: 8,
  },
  container: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.purple,
  },
  header: {
    backgroundColor: Styles.globalColors.transparent,
    width: '100%',
  },
  safeAreaViewTop: {backgroundColor: Styles.globalColors.purple, flexGrow: 0},
  text: { color: Styles.globalColors.white },
  topContainer: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
})

export default QRScan
