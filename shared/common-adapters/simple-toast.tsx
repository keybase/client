import Toast from './toast'
import {Box2} from './box'
import Icon, {type IconType} from './icon'
import Text from './text'
import * as Styles from '../styles'

const Kb = {
  Box2,
  Icon,
  Text,
  Toast,
}

type Props = {
  iconType: IconType
  visible: boolean
  text: string
}

const SimpleToast = (props: Props) => (
  <Kb.Toast visible={props.visible}>
    <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true}>
      <Kb.Icon type={props.iconType} color={Styles.globalColors.white} />
      <Kb.Text type="BodySemibold" style={styles.toastText}>
        {props.text}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Toast>
)

export default SimpleToast

const styles = Styles.styleSheetCreate(() => ({
  toastText: {color: Styles.globalColors.white},
}))
