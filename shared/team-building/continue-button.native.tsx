import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import Flags from '../util/feature-flags'
import {Props} from './continue-button'

const ContinueButton = (props: Props) => (
  <Kb.Button
    fullWidth={true}
    style={styles.button}
    onClick={props.onClick}
    disabled={props.disabled}
    label={'Continue' + (Flags.wonderland ? ' 🐇' : '')}
  />
)

const styles = Styles.styleSheetCreate(() => ({
  button: {flexGrow: 0},
}))

export default ContinueButton
