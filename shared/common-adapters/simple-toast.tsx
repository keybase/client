import Toast from './toast'
import {Box2} from './box'
import IconAuto from './icon-auto'
import type {IconType} from './icon.constants-gen'
import Text from './text'
import type {MeasureRef} from './measure-ref'
import * as Styles from '@/styles'

const Kb = {
  Box2,
  IconAuto,
  Text,
  Toast,
}

type Props = {
  iconType: IconType
  visible: boolean
  text: string
  toastTargetRef?: React.RefObject<MeasureRef | null>
}

const SimpleToast = (props: Props) => {
  const styles = useStyles()
  const theme = Styles.useTheme()
  return (
    <Kb.Toast visible={props.visible} attachTo={props.toastTargetRef}>
      <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true}>
        <Kb.IconAuto type={props.iconType} color={theme.white} />
        <Kb.Text type="BodySemibold" style={styles.toastText}>
          {props.text}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Toast>
  )
}

export default SimpleToast

const useStyles = Styles.createStyleHook(theme => ({
  toastText: {color: theme.white},
}))
