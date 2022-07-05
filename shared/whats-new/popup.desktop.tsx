import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import WhatsNew from './container'
import {Position} from '../common-adapters/relative-popup-hoc.types'

type Props = {
  attachTo: () => Kb.Box2 | null
  onHidden: () => void
  position: Position
  positionFallbacks?: Position[]
}

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
