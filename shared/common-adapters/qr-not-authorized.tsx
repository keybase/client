import * as ConfigGen from '../actions/config-gen'
import * as Styles from '../styles'
import * as Container from '../util/container'
import Text from './text'
import {Box2} from './box'
import Icon from './icon'

type OwnProps = {}
const Kb = {Box2, Icon, Text}

const QRScanNotAuthorized = ({onOpenSettings}: {onOpenSettings: () => void}) => (
  <Kb.Box2 direction="vertical" style={styles.container} gap="tiny">
    <Kb.Icon type="iconfont-camera" color={Styles.globalColors.white_40} />
    <Kb.Text center={true} type="BodyTiny" style={styles.text}>
      You need to allow access to the camera.
    </Kb.Text>
    <Kb.Text center={true} type="BodyTiny" onClick={onOpenSettings} style={styles.text} underline={true}>
      Open settings
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignItems: 'center',
        backgroundColor: Styles.globalColors.black,
        flexGrow: 1,
        justifyContent: 'center',
      },
      text: {color: Styles.globalColors.white_40},
    } as const)
)

export default Container.connect(
  () => ({}),
  dispatch => ({onOpenSettings: () => dispatch(ConfigGen.createOpenAppSettings())}),
  (_, dispatchProps, __: OwnProps) => ({...dispatchProps})
)(QRScanNotAuthorized)
