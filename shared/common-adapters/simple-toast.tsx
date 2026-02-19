import Toast from './toast'
import {Box2} from './box'
import Icon, {type IconType} from './icon'
import {Text3} from './text3'
import type {MeasureRef} from './measure-ref'
import * as Styles from '@/styles'

const Kb = {
  Box2,
  Icon,
  Text3,
  Toast,
}

type Props = {
  iconType: IconType
  visible: boolean
  text: string
  toastTargetRef?: React.RefObject<MeasureRef | null>
}

const SimpleToast = (props: Props) => (
  <Kb.Toast visible={props.visible} attachTo={props.toastTargetRef}>
    <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true}>
      <Kb.Icon type={props.iconType} color={Styles.globalColors.white} />
      <Kb.Text3 type="BodySemibold" style={styles.toastText}>
        {props.text}
      </Kb.Text3>
    </Kb.Box2>
  </Kb.Toast>
)

export default SimpleToast

const styles = Styles.styleSheetCreate(() => ({
  toastText: {color: Styles.globalColors.white},
}))
