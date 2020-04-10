import * as React from 'react'
import Box from './box'
import PopupDialog from './popup-dialog'
import {collapseStyles, globalColors, isMobile} from '../styles'

type Props = {
  onClose: () => void
  onMouseUp?: (e: React.MouseEvent) => void
  onMouseDown?: (e: React.MouseEvent) => void
  onMouseMove?: (e: React.MouseEvent) => void
  children: React.ReactNode
  cover?: boolean
  styleCover?: any
  styleClipContainer?: any
  styleContainer?: any
}

const MaybePopup = isMobile
  ? (props: Props) => <Box style={{height: '100%', width: '100%'}} children={props.children} />
  : (props: Props) => (
      <PopupDialog
        onClose={props.onClose}
        onMouseUp={props.onMouseUp}
        onMouseDown={props.onMouseDown}
        onMouseMove={props.onMouseMove}
        styleCover={collapseStyles([props.cover && _styleCover, props.styleCover])}
        styleContainer={props.cover ? {..._styleContainer, ...props.styleContainer} : {}}
        styleClipContainer={props.styleClipContainer}
        children={props.children}
      />
    )

const _styleCover = {
  alignItems: 'stretch',
  backgroundColor: globalColors.black,
  justifyContent: 'stretch',
}

const _styleContainer = {
  height: '100%',
}

export {MaybePopup}
