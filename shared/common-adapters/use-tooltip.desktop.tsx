import * as React from 'react'
import * as Styles from '@/styles'
import type {Props} from './use-tooltip'
import Toast from './toast'
import Text from './text'

const Kb = {
  Text,
  Toast,
}

export const useTooltip = (p: Props) => {
  const {tooltip, attachTo, position, toastClassName} = p

  const [visible, setVisible] = React.useState(false)
  const onMouseOver = React.useCallback(() => {
    setVisible(true)
  }, [])
  const onMouseLeave = React.useCallback(() => {
    setVisible(false)
  }, [])

  React.useEffect(() => {
    const d = attachTo.current?.divRef.current
    if (!d) return
    d.addEventListener('mouseover', onMouseOver)
    d.addEventListener('mouseleave', onMouseLeave)

    return () => {
      d.removeEventListener('mouseover', onMouseOver)
      d.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [attachTo, onMouseOver, onMouseLeave])

  return visible ? (
    <Kb.Toast
      containerStyle={Styles.collapseStyles([
        styles.container,
        // multiline && styles.containerMultiline,
        // backgroundColor && {backgroundColor},
        // toastStyle,
      ])}
      visible={true}
      attachTo={attachTo}
      position={position || 'top center'}
      className={toastClassName}
    >
      <Kb.Text
        center={!Styles.isMobile}
        type="BodySmall"
        style={Styles.collapseStyles([styles.text /*, textStyle*/])}
      >
        {tooltip}
      </Kb.Text>
    </Kb.Toast>
  ) : null
}

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {
      borderRadius: Styles.borderRadius,
      pointerEvents: 'none',
    },
  }),
  containerMultiline: {
    maxWidth: 320,
    minWidth: 320,
    width: 320,
  },
  text: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.white,
      wordBreak: 'break-word',
    } as const,
  }),
}))
