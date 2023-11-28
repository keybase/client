import * as Kb from '@/common-adapters'
import WhatsNew from '.././container'
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.rounded,
      marginRight: Kb.Styles.globalMargins.tiny,
    },
    isElectron: {
      ...Kb.Styles.desktopStyles.boxShadow,
    },
  }),
}))

export default Popup
