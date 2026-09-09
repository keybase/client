import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from '../box'
import {EscapeHandler} from '../key-event-handler.desktop'
import type {ModalCoverProps} from './index.shared'
export type {ModalCoverProps} from './index.shared'

const noop = () => {}

function stopBubbling(ev: React.MouseEvent<HTMLDivElement>) {
  ev.stopPropagation()
}

export function ModalCover(props: ModalCoverProps) {
  const styles = useStyles()
  const {children, onHidden, style} = props

  // a press that starts on the content and ends on the cover must not dismiss,
  // so the cover only closes when its own mousedown was the one that opened
  const [mouseDownOnCover, setMouseDownOnCover] = React.useState(false)
  return (
    <EscapeHandler onESC={onHidden ?? noop}>
      <Box2
        direction="vertical"
        centerChildren={true}
        style={Styles.collapseStyles([styles.cover, style])}
        onMouseUp={() => {
          if (mouseDownOnCover) {
            onHidden?.()
          }
        }}
        onMouseDown={() => {
          setMouseDownOnCover(true)
        }}
      >
        <Box2
          direction="horizontal"
          relative={true}
          style={styles.centeredContainer}
          onMouseDown={(e: React.BaseSyntheticEvent) => {
            setMouseDownOnCover(false)
            e.stopPropagation()
          }}
          onMouseUp={(e: React.BaseSyntheticEvent) => e.stopPropagation()}
        >
          <div style={styles.clipContainer as React.CSSProperties} onClick={stopBubbling}>
            {children}
          </div>
        </Box2>
      </Box2>
    </EscapeHandler>
  )
}

const useStyles = Styles.createStyleHook(theme => ({
  centeredContainer: {
    maxHeight: '100%',
    maxWidth: '100%',
  },
  clipContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      ...Styles.globalStyles.flexBoxColumn,
      backgroundColor: theme.white,
      borderRadius: Styles.borderRadius,
      flex: 1,
      maxWidth: '100%',
      position: 'relative',
    },
  }),
  cover: {
    ...Styles.globalStyles.fillAbsolute,
    alignSelf: 'stretch',
    ...Styles.padding(Styles.globalMargins.large, Styles.globalMargins.large, Styles.globalMargins.small),
  },
}))

export default ModalCover
