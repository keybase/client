import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from '../box'
import type {MeasureRef} from '../measure-ref'
import {OverlayEntry} from '../overlay/entry.desktop'
import type {ModalCoverProps} from './index.shared'
export type {ModalCoverProps} from './index.shared'

function stopBubbling(ev: React.SyntheticEvent) {
  ev.stopPropagation()
}

export function ModalCover(props: ModalCoverProps) {
  const styles = useStyles()
  const {children, onHidden, style} = props
  const centeredRef = React.useRef<MeasureRef>(null)
  // a click on the cover around the content closes it
  const outside = onHidden
    ? {
        content: () => (centeredRef.current instanceof Element ? centeredRef.current : null),
        onOutside: onHidden,
        propagate: true,
      }
    : undefined
  return (
    <OverlayEntry
      acceptsKeys={true}
      blocking={true}
      kind="modal"
      onEscape={onHidden}
      outside={outside}
    >
      <Box2 alignSelf="center" direction="vertical" centerChildren={true} style={Styles.collapseStyles([styles.cover, style])}>
        {/* presses inside stay out of the handlers of whatever rendered the cover */}
        <Box2
          alignSelf="center"
          direction="horizontal"
          relative={true}
          ref={centeredRef}
          style={styles.centeredContainer}
          onMouseDown={stopBubbling}
          onMouseUp={stopBubbling}
        >
          <div style={styles.clipContainer as React.CSSProperties} onClick={stopBubbling}>
            {children}
          </div>
        </Box2>
      </Box2>
    </OverlayEntry>
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
