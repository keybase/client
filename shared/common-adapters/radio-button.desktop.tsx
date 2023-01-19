import * as Styles from '../styles'
import Text from './text'
import type {Props} from './radio-button'
import './radio-button.css'

const Kb = {
  Text,
}

const RadioButton = ({disabled, label, onSelect, selected, style}: Props) => (
  <div
    style={{...styles.container, ...(disabled ? {} : Styles.desktopStyles.clickable), ...style}}
    onClick={disabled ? undefined : () => onSelect(!selected)}
  >
    <div className={Styles.classNames('radio-button', {disabled, selected})}>
      <div style={styles.radio} />
    </div>
    <Kb.Text type="Body" style={{color: Styles.globalColors.black}}>
      {label}
    </Kb.Text>
  </div>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  radio: {
    ...Styles.transition('opacity'),
    border: `solid 3px ${Styles.globalColors.white}`,
    borderRadius: 100,
    color: Styles.globalColors.white,
    hoverColor: Styles.globalColors.white,
    left: 3,
    position: 'absolute',
    top: 3,
  },
}))

export default RadioButton
