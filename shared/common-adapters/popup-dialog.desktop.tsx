import * as React from 'react'
import Box from './box'
import Icon from './icon'
import {EscapeHandler} from '../util/key-event-handler.desktop'
import * as Styles from '../styles'
import type {Props} from './popup-dialog'

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
  const [mouseDownOnCover, setMouseDownOnCover] = React.useState(false)
  return (
    <EscapeHandler onESC={!immuneToEscape ? onClose || null : null}>
      <Box
        style={Styles.collapseStyles([styles.cover, styleCover])}
        onMouseUp={(e: React.MouseEvent) => {
          if (mouseDownOnCover) {
            onClose && onClose()
          }
          onMouseUp && onMouseUp(e)
        }}
        onMouseDown={(e: React.MouseEvent) => {
          setMouseDownOnCover(true)
          onMouseDown && onMouseDown(e)
        }}
        onMouseMove={onMouseMove}
      >
        <Box
          style={Styles.collapseStyles([styles.container, fill && styles.containerFill, styleContainer])}
          onMouseDown={(e: React.BaseSyntheticEvent) => {
            setMouseDownOnCover(false)
            e.stopPropagation()
          }}
          onMouseUp={(e: React.BaseSyntheticEvent) => e.stopPropagation()}
        >
          {onClose && (
            <Icon
              type="iconfont-close"
              style={Styles.collapseStyles([styles.close, styleClose])}
              color={Styles.globalColors.whiteOrWhite_75}
              onClick={onClose}
              hoverColor={Styles.globalColors.white_40OrWhite_40}
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
  get clipContainer() {
    return Styles.platformStyles({
      isElectron: {
        ...Styles.desktopStyles.boxShadow,
        ...Styles.globalStyles.flexBoxColumn,
        backgroundColor: Styles.globalColors.white,
        borderRadius: Styles.borderRadius,
        flex: 1,
        maxWidth: '100%',
        position: 'relative',
      },
    })
  },
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
    backgroundColor: Styles.globalColors.black_50OrBlack_60,
    justifyContent: 'center',
    paddingBottom: Styles.globalMargins.small,
    paddingLeft: Styles.globalMargins.large,
    paddingRight: Styles.globalMargins.large,
    paddingTop: Styles.globalMargins.large,
  },
  coverTabBarShim: {
    ...Styles.globalStyles.flexBoxRow,
    ...Styles.globalStyles.fillAbsolute,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.black_50OrBlack_60,
    justifyContent: 'center',
    paddingBottom: Styles.globalMargins.small,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: Styles.globalMargins.large,
  },
}))

export default PopupDialog
