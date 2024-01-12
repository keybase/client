import * as React from 'react'
import * as Styles from '@/styles'
import {Box2Measure} from './box'
import Toast from './toast'
import Text from './text'
import type {Props} from './with-tooltip'
import type {MeasureRef} from './measure-ref'

const IGNORE_FOR_PROFILING = false as boolean

const Kb = {
  Box2Measure,
  Text,
  Toast,
}

const WithTooltip = React.memo(function WithTooltip(p: Props) {
  const {containerStyle, className, multiline, backgroundColor, toastStyle} = p
  const {disabled, toastClassName, children, position, textStyle, tooltip} = p
  const popupAnchor = React.useRef<MeasureRef>(null)
  const [visible, setVisible] = React.useState(false)

  const onMouseEnter = React.useCallback(() => {
    setVisible(true)
  }, [])
  const onMouseLeave = React.useCallback(() => {
    setVisible(false)
  }, [])

  const toast = React.useMemo(() => {
    return (
      <Kb.Toast
        containerStyle={Styles.collapseStyles([
          styles.container,
          multiline && styles.containerMultiline,
          backgroundColor && {backgroundColor},
          toastStyle,
        ])}
        visible={true}
        attachTo={popupAnchor}
        position={position || 'top center'}
        className={toastClassName}
      >
        <Kb.Text
          center={!Styles.isMobile}
          type="BodySmall"
          style={Styles.collapseStyles([styles.text, textStyle])}
        >
          {tooltip}
        </Kb.Text>
      </Kb.Toast>
    )
  }, [backgroundColor, multiline, position, textStyle, toastClassName, toastStyle, tooltip])

  return (
    <>
      <Kb.Box2Measure
        direction="vertical"
        alignSelf="stretch"
        alignItems="center"
        style={containerStyle}
        ref={popupAnchor}
        onMouseOver={IGNORE_FOR_PROFILING ? undefined : onMouseEnter}
        onMouseLeave={IGNORE_FOR_PROFILING ? undefined : onMouseLeave}
        className={className}
      >
        {children}
      </Kb.Box2Measure>
      {!disabled && visible && tooltip ? toast : null}
    </>
  )
})

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

export default WithTooltip
