import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import Box from './box'
import PopupDialog from './popup-dialog'
import {connect} from '../util/container'
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

// TODO properly type this
const DispatchNavUpHoc: any = connect(
  () => ({}),
  // @ts-ignore codemod issue
  (dispatch, {navigateUp}) => ({
    connectedNavigateUp: () => dispatch(navigateUp ? navigateUp() : RouteTreeGen.createNavigateUp()),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)

// TODO properly type this
const _MaybePopupHoc: any = (cover: boolean) => {
  return WrappedComponent => props => {
    const {
      onClose,
      connectedNavigateUp,
      onMouseUp,
      onMouseDown,
      onMouseMove,
      styleCover,
      styleContainer,
      styleClipContainer,
      ...rest
    } = props
    const _onClose = onClose || connectedNavigateUp
    return (
      <MaybePopup
        onClose={_onClose}
        cover={!!cover}
        onMouseUp={onMouseUp}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        styleCover={styleCover}
        styleContainer={styleContainer}
        styleClipContainer={styleClipContainer}
      >
        <WrappedComponent onClose={_onClose} {...rest} />
      </MaybePopup>
    )
  }
}

type MaybePopupHocType<P> = (
  cover: boolean
) => (WrappedComponent: React.ComponentType<P>) => React.ComponentType<P>
const MaybePopupHoc: MaybePopupHocType<any> = (cover: boolean) => Component =>
  DispatchNavUpHoc(_MaybePopupHoc(cover)(Component))

const _styleCover = {
  alignItems: 'stretch',
  backgroundColor: globalColors.black,
  justifyContent: 'stretch',
}

const _styleContainer = {
  height: '100%',
}

export {MaybePopup, MaybePopupHoc}
