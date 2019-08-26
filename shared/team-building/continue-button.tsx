import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import Flags from '../util/feature-flags'

export type Props = {
  onClick: () => void
  disabled: boolean
}

const ContinueButton = (props: Props) => (
  <Kb.Button fullWidth={true} style={styles.button} onClick={props.onClick} disabled={props.disabled}>
    <Kb.Text type="BodyBig" style={styles.continueText}>
      Continue
    </Kb.Text>
    {Flags.wonderland && (
      <Kb.Text type="BodyBig" style={styles.rabbitEmoji}>
        <Kb.Emoji size={16} emojiName=":rabbit2:" />
      </Kb.Text>
    )}
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
