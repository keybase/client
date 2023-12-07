import * as React from 'react'
import Box from './box'
import PopupDialog from './popup-dialog'
import * as Styles from '@/styles'

type Props = {
  onClose: () => void
  onMouseUp?: (e: React.MouseEvent) => void
  onMouseDown?: (e: React.MouseEvent) => void
  onMouseMove?: (e: React.MouseEvent) => void
  children: React.ReactNode
  cover?: boolean
  styleCover?: Styles.StylesCrossPlatform
  styleClipContainer?: Styles.StylesCrossPlatform
  styleContainer?: Styles.StylesCrossPlatform
}

const MaybePopup = Styles.isMobile
  ? (props: Props) => <Box style={{height: '100%', width: '100%'}} children={props.children} />
  : (props: Props) => (
      <PopupDialog
        onClose={props.onClose}
        onMouseUp={props.onMouseUp}
        onMouseDown={props.onMouseDown}
        onMouseMove={props.onMouseMove}
        styleCover={Styles.collapseStyles([props.cover && _styleCover, props.styleCover])}
        styleContainer={props.cover ? {..._styleContainer, ...props.styleContainer} : {}}
        styleClipContainer={props.styleClipContainer}
        children={props.children}
      />
    )

const _styleCover = {
  alignItems: 'stretch',
  backgroundColor: Styles.globalColors.black,
} as const

const _styleContainer = {
  height: '100%',
} as const

export {MaybePopup}
