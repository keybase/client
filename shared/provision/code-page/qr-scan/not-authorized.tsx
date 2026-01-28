import * as Kb from '@/common-adapters'
import {useConfigState} from '@/stores/config'

const QRScanNotAuthorized = () => {
  const onOpenSettings = useConfigState(s => s.dispatch.defer.openAppSettings)
  return (
    <Kb.Box2 direction="vertical" style={styles.container} gap="tiny">
      <Kb.Icon type="iconfont-camera" color={Kb.Styles.globalColors.white_40} />
      <Kb.Text center={true} type="BodyTiny" style={styles.text}>
        You need to allow access to the camera.
      </Kb.Text>
      <Kb.Text center={true} type="BodyTiny" onClick={onOpenSettings} style={styles.text} underline={true}>
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
        flexGrow: 1,
        justifyContent: 'center',
      },
      text: {color: Kb.Styles.globalColors.white_40},
    }) as const
)

export default QRScanNotAuthorized
