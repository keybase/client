import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import WhatsNew from './container'
import type {Props} from './popup'

const Popup = (props: Props) => {
  return (
    <Kb.FloatingBox
      position={props.position}
      positionFallbacks={props.positionFallbacks}
      containerStyle={styles.container}
      onHidden={props.onHidden}
      attachTo={props.attachTo}
    >
      <WhatsNew onBack={props.onHidden} />
    </Kb.FloatingBox>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.rounded,
      marginRight: Styles.globalMargins.tiny,
    },
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
    },
  }),
}))

export default Popup
