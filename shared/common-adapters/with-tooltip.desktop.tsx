import * as React from 'react'
import * as Styles from '../styles'
import {Box2} from './box'
import Toast from './toast'
import Text from './text'
import type {Props} from './with-tooltip'

const Kb = {
  Box2,
  Text,
  Toast,
}

const WithTooltip = React.memo(function WithTooltip(p: Props) {
  const {containerStyle, className, multiline, backgroundColor, toastStyle} = p
  const {disabled, toastClassName, children, position, textStyle, tooltip} = p
  const attachmentRef = React.useRef(null)
  const [mouseIn, setMouseIn] = React.useState(false)
  const [visible, setVisible] = React.useState(false)

  const onMouseEnter = React.useCallback(() => {
    setMouseIn(true)
  }, [])
  const onMouseLeave = React.useCallback(() => {
    setMouseIn(false)
  }, [])

  React.useEffect(() => {
    setVisible(mouseIn)
  }, [mouseIn])

  const setAttachmentRef = React.useCallback(ref => {
    attachmentRef.current = ref
  }, [])
  const getAttachmentRef = React.useCallback(() => attachmentRef.current, [])

  return (
    <>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={containerStyle}
        ref={setAttachmentRef}
        onMouseOver={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={className}
      >
        {children}
      </Kb.Box2>
      {!disabled && mouseIn && (
        <Kb.Toast
          containerStyle={Styles.collapseStyles([
            styles.container,
            multiline && styles.containerMultiline,
            backgroundColor && {backgroundColor: backgroundColor},
            toastStyle,
          ])}
          visible={!!tooltip && visible}
          attachTo={getAttachmentRef}
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
