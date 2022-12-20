import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'

export type Props = {
  label: string
  onClick: () => void
  disabled: boolean
}

const ContinueButton = (props: Props) => (
  <Kb.Button fullWidth={true} style={styles.button} onClick={props.onClick} disabled={props.disabled}>
    <Kb.Text type="BodyBig" style={styles.continueText}>
      {props.label}
    </Kb.Text>
  </Kb.Button>
)

const styles = Styles.styleSheetCreate(() => ({
  button: {flexGrow: 0},
  continueText: {
    color: Styles.globalColors.white,
  },
  rabbitEmoji: {
    marginLeft: Styles.globalMargins.xtiny,
  },
}))

export default ContinueButton
