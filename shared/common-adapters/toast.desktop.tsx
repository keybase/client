import * as C from '@/constants'
import * as React from 'react'
import type {Props} from './toast'
import Popup from './popup'
import * as Styles from '@/styles'
import './toast.css'

const positionFallbacks = [] as const

const Toast = (props: Props) => {
  const [dismissedOnBlur, setDismissedOnBlur] = React.useState(false)
  const lastVisibleRef = React.useRef(props.visible)

  React.useEffect(() => {
    if (!props.visible || !lastVisibleRef.current) {
      setDismissedOnBlur(false)
    }
    lastVisibleRef.current = props.visible
  }, [props.visible])

  C.Router2.useSafeFocusEffect(() => {
    setDismissedOnBlur(false)
    return () => {
      setDismissedOnBlur(true)
    }
  })

  return (
    <Popup
      propagateOutsideClicks={true}
      containerStyle={styles.float}
      offset={4}
      positionFallbacks={positionFallbacks}
      {...(props.attachTo === undefined ? {} : {attachTo: props.attachTo})}
      {...(props.position === undefined ? {} : {position: props.position})}
    >
      <div
        className={Styles.classNames(
          {visible: props.visible && !dismissedOnBlur},
          props.className,
          'fadeBox'
        )}
        style={Styles.collapseStyles([styles.container, props.containerStyle]) as React.CSSProperties}
      >
        {props.children}
      </div>
    </Popup>
  )
}
export default Toast

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.black,
      borderRadius: Styles.borderRadius,
      borderWidth: 0,
      justifyContent: 'center',
      margin: Styles.globalMargins.xtiny,
      paddingBottom: Styles.globalMargins.xtiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.xtiny,
      pointerEvents: 'none',
      position: 'relative',
    },
  }),
  float: Styles.platformStyles({
    isElectron: {pointerEvents: 'none'},
  }),
}))
