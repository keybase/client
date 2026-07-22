import * as Styles from '@/styles'
import {Box2} from './box'
import ProgressIndicator from './progress-indicator'

const Kb = {
  Box2,
  ProgressIndicator,
}

// full-size centered spinner, for screens that have nothing to show yet
export const LoadingScreen = (props: {type?: 'Small' | 'Large' | 'Huge'}) => (
  <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} centerChildren={true} padding="small">
    <Kb.ProgressIndicator type={props.type} />
  </Kb.Box2>
)

// spinner covering the parent (which needs relative positioning) while keeping content visible
export const LoadingOverlay = (props: {show: boolean}) =>
  props.show ? (
    // fullWidth/fullHeight required: without them desktop Box2 adds align-self:center, which
    // collapses this absolutely-positioned box to a content-height band instead of filling.
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} centerChildren={true} style={styles.overlay}>
      <Kb.ProgressIndicator />
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate(() => ({
  overlay: {...Styles.globalStyles.fillAbsolute},
}))
