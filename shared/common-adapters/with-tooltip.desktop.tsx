import * as React from 'react'
import * as Styles from '@/styles'
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

function WithTooltip(p: Props) {
  const {containerStyle, className, multiline, backgroundColor, toastStyle} = p
  const {disabled, toastClassName, children, position, textStyle, tooltip} = p
  const popupAnchor = React.useRef<MeasureRef | null>(null)
  const [visible, setVisible] = React.useState(false)

  const onMouseEnter = () => {
    setVisible(true)
  }
  const onMouseLeave = () => {
    setVisible(false)
  }

  const toast = (
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
      {...(toastClassName === undefined ? {} : {className: toastClassName})}
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

  return (
    <>
      <Kb.Box2
        direction="vertical"
        alignSelf="stretch"
        alignItems="center"
        justifyContent="center"
        ref={popupAnchor}
        {...(containerStyle === undefined ? {} : {style: containerStyle})}
        {...(IGNORE_FOR_PROFILING ? {} : {onMouseOver: onMouseEnter, onMouseLeave})}
        {...(className === undefined ? {} : {className})}
      >
        {children}
      </Kb.Box2>
      {!disabled && visible && tooltip ? toast : null}
    </>
  )
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

export default WithTooltip
