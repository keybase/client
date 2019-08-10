import * as React from 'react'
import Box from './box'
import Icon from './icon'
import {EscapeHandler} from '../util/key-event-handler.desktop'
import * as Styles from '../styles'
import {Props} from './popup-dialog'

function stopBubbling(ev) {
  ev.stopPropagation()
}

export function PopupDialog({
  children,
  onClose,
  onMouseUp,
  onMouseDown,
  onMouseMove,
  fill,
  immuneToEscape,
  styleCover,
  styleContainer,
  styleClose,
  styleClipContainer,
  allowClipBubbling,
}: Props) {
  return (
    <EscapeHandler onESC={!immuneToEscape ? onClose || null : null}>
      <Box
        style={Styles.collapseStyles([styles.cover, styleCover])}
        onClick={onClose}
        onMouseUp={onMouseUp}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
      >
        <Box style={Styles.collapseStyles([styles.container, fill && styles.containerFill, styleContainer])}>
          {onClose && (
            <Icon
              type="iconfont-close"
              style={Styles.collapseStyles([styles.close, styleClose])}
              color={Styles.globalColors.white}
              onClick={onClose}
              hoverColor={Styles.globalColors.white_40}
            />
          )}
          <Box
            style={Styles.collapseStyles([styles.clipContainer, styleClipContainer])}
            onClick={allowClipBubbling ? undefined : stopBubbling}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </EscapeHandler>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  clipContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      ...Styles.globalStyles.flexBoxColumn,
      backgroundColor: Styles.globalColors.white,
      borderRadius: Styles.borderRadius,
      flex: 1,
      maxWidth: '100%',
      position: 'relative',
    },
  }),
  close: Styles.platformStyles({
    isElectron: {
      cursor: 'pointer',
      padding: Styles.globalMargins.tiny,
      position: 'absolute',
      right: Styles.globalMargins.tiny * -4,
    },
  }),
  container: {
    ...Styles.globalStyles.flexBoxRow,
    maxHeight: '100%',
    maxWidth: '100%',
    position: 'relative',
  },
  containerFill: {
    height: '100%',
    width: '100%',
  },
  cover: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.globalStyles.fillAbsolute,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.black_50,
    justifyContent: 'center',
    paddingBottom: Styles.globalMargins.small,
    paddingLeft: Styles.globalMargins.large,
    paddingRight: Styles.globalMargins.large,
    paddingTop: Styles.globalMargins.large,
  },
}))

export default PopupDialog
