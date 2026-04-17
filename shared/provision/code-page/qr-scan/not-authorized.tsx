import * as Kb from '@/common-adapters'
import {openAppSettings} from '@/util/storeless-actions'

const QRScanNotAuthorized = () => {
  return (
    <Kb.Box2 direction="vertical" justifyContent="center" flex={1} style={styles.container} gap="tiny">
      <Kb.Icon type="iconfont-camera" color={Kb.Styles.globalColors.white_40} />
      <Kb.Text center={true} type="BodyTiny" style={styles.text}>
        You need to allow access to the camera.
      </Kb.Text>
      <Kb.Text center={true} type="BodyTiny" onClick={openAppSettings} style={styles.text} underline={true}>
        Open settings
      </Kb.Text>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.black,
      },
      text: {color: Kb.Styles.globalColors.white_40},
    }) as const
)

export default QRScanNotAuthorized
