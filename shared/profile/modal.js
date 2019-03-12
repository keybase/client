// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import flags from '../util/feature-flags'

type Props = {|
  children: React.Node,
  onCancel?: () => void,
  skipButton?: boolean,
|}

const Modal = ({children, onCancel, skipButton}: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
    <Kb.Box2 direction="vertical" style={styles.content} fullWidth={true} alignItems="center">
      {children}
    </Kb.Box2>
    {onCancel && !skipButton && (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.buttonBar} alignItems="center">
        <Kb.Button type="Secondary" label="Cancel" onClick={onCancel} />
      </Kb.Box2>
    )}
  </Kb.Box2>
)

// TODO remove
const OldScreen = ({children, onCancel}: Props) => (
  <Kb.StandardScreen onCancel={onCancel} style={{maxWidth: 512}}>
    {children}
    {onCancel && (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.buttonBar} alignItems="center">
        <Kb.Button type="Secondary" label="Cancel" onClick={onCancel} />
      </Kb.Box2>
    )}
  </Kb.StandardScreen>
)

const styles = Styles.styleSheetCreate({
  buttonBar: {
    flexShrink: 0,
    padding: Styles.isMobile ? undefined : Styles.globalMargins.medium,
  },
  container: {
    minHeight: Styles.isMobile ? undefined : 450,
    padding: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.medium,
    width: Styles.isMobile ? undefined : 560,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-around',
  },
})

export default (flags.useNewRouter ? Kb.HeaderOrPopup(Modal) : OldScreen)
