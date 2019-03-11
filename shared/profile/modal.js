// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import flags from '../util/feature-flags'

type Props = {|
  children: React.Node,
  onCancel?: () => void,
|}
const Modal = ({children, onCancel}: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
    <Kb.Box2 direction="vertical" style={styles.content} fullWidth={true} alignItems="center">
      {children}
    </Kb.Box2>
    {onCancel && (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.buttonBar} alignItems="center">
        <Kb.Button type="Secondary" label="Cancel" onClick={onCancel} />
      </Kb.Box2>
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  buttonBar: {
    flexShrink: 0,
    padding: Styles.isMobile ? undefined : Styles.globalMargins.medium,
  },
  container: {
    width: Styles.isMobile ? undefined : 560,
    minHeight: Styles.isMobile ? undefined : 450,
    padding: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.medium,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-around',
  },
})

export default (flags.useNewRouter ? Kb.HeaderOrPopup(Modal) : Modal)
