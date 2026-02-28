import * as Kb from '@/common-adapters/index'

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

const styles = Kb.Styles.styleSheetCreate(() => ({
  button: {flexGrow: 0},
  continueText: {
    color: Kb.Styles.globalColors.white,
  },
  rabbitEmoji: {
    marginLeft: Kb.Styles.globalMargins.xtiny,
  },
}))

export default ContinueButton
