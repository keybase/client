import * as React from 'react'
import * as Styles from '../styles'
import {Box2} from './box'
import Toast from './toast'
import Text from './text'
import type {Props} from './with-tooltip'
import type {MeasureRef} from './measure-ref'

const IGNORE_FOR_PROFILING = false as boolean

const Kb = {
  Box2,
  Text,
  Toast,
}

const WithTooltip = React.memo(function WithTooltip(p: Props) {
  const {containerStyle, className, multiline, backgroundColor, toastStyle} = p
  const {disabled, toastClassName, children, position, textStyle, tooltip} = p
  const attachmentRef = React.useRef<MeasureRef>(null)
  const [visible, setVisible] = React.useState(false)

  const onMouseEnter = React.useCallback(() => {
    setVisible(true)
  }, [])
  const onMouseLeave = React.useCallback(() => {
    setVisible(false)
  }, [])

  return (
    <>
      <Kb.Box2
        direction="vertical"
        alignSelf="stretch"
        alignItems="center"
        style={containerStyle}
        ref={attachmentRef}
        onMouseOver={IGNORE_FOR_PROFILING ? undefined : onMouseEnter}
        onMouseLeave={IGNORE_FOR_PROFILING ? undefined : onMouseLeave}
        className={className}
      >
        {children}
      </Kb.Box2>
      {!disabled && visible && (
        <Kb.Toast
          containerStyle={Styles.collapseStyles([
            styles.container,
            multiline && styles.containerMultiline,
            backgroundColor && {backgroundColor: backgroundColor},
            toastStyle,
          ])}
          visible={!!tooltip && visible}
          attachTo={attachmentRef}
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
      )}
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
