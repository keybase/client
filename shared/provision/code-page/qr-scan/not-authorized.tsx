import * as Kb from '@/common-adapters'
import {openAppSettings} from '@/util/storeless-actions'

const QRScanNotAuthorized = () => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.Box2 direction="vertical" centerChildren={true} flex={1} style={styles.container} gap="tiny">
      <Kb.Icon type="iconfont-camera" color={theme.white_40} />
      <Kb.Text center={true} type="BodyTiny" style={styles.text}>
        You need to allow access to the camera.
      </Kb.Text>
      <Kb.Text center={true} type="BodyTiny" onClick={openAppSettings} style={styles.text} underline={true}>
        Open settings
      </Kb.Text>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      container: {
        backgroundColor: theme.black,
      },
      text: {color: theme.white_40},
    }) as const
)

export default QRScanNotAuthorized
