// @flow
import * as React from 'react'
import FloatingBox from './floating-box'
import type {Position} from './relative-popup-hoc'
import PopupMenu, {type MenuItem, ModalLessPopupMenu} from './popup-menu'
import {isMobile} from '../constants/platform'
import {type StylesCrossPlatform} from '../styles'
import {NativeKeyboard} from '../common-adapters/native-wrappers.native'

export type Props = {
  closeOnSelect?: boolean,
  containerStyle?: StylesCrossPlatform,
  items: Array<MenuItem | 'Divider' | null>,
  header?: MenuItem,
  onHidden: () => void,
  visible: boolean,
  attachTo?: ?React.Component<any, any>,
  position?: Position,
  propagateOutsideClicks?: boolean,
}

export default (props: Props) => {
  if (!props.visible) {
    return null
  }
  const PopupComponent = isMobile ? PopupMenu : ModalLessPopupMenu
  return (
    <FloatingBox
      position={props.position}
      onHidden={props.onHidden}
      visible={props.visible}
      attachTo={props.attachTo}
      containerStyle={props.containerStyle}
      propagateOutsideClicks={props.propagateOutsideClicks}
    >
      <PopupComponent
        header={props.header}
        onHidden={props.onHidden}
        items={props.items}
        closeOnClick={!!props.closeOnSelect}
      />
    </FloatingBox>
  )
}

export type FloatingMenuParentProps = {
  attachmentRef: ?React.Component<any, any>,
  showingMenu: boolean,
  setAttachmentRef: ?(?React.Component<any, any>) => void,
  setShowingMenu: boolean => void,
  toggleShowingMenu: () => void,
}

type State = {|
  attachmentRef: ?React.Component<any, any>,
  showingMenu: boolean,
|}

type Callbacks = {|
  setShowingMenu: boolean => void,
  toggleShowingMenu: () => void,
  // WARNING: Only use setAttachmentRef on class components. Otherwise the ref will be
  // optimized out in production code!
  setAttachmentRef: ?(?React.Component<any, any>) => void,
|}

export const FloatingMenuParentHOC = <T: FloatingMenuParentProps>(
  ComposedComponent: React.ComponentType<T>
): React.ComponentType<$Diff<T, FloatingMenuParentProps>> => {
  class FloatingMenuParent extends React.Component<$Diff<T, FloatingMenuParentProps>, State> {
    _setters: Callbacks
    state = {attachmentRef: null, showingMenu: false}
    constructor(props: $Diff<T, FloatingMenuParentProps>) {
      super(props)
      this._setters = {
        setShowingMenu: showingMenu => this.setState({showingMenu}),
        toggleShowingMenu: () => {
          // Hide the keyboard on mobile when showing the menu.
          isMobile && !this.state.showingMenu && NativeKeyboard.dismiss()
          this.setState(oldState => ({showingMenu: !oldState.showingMenu}))
        },
        setAttachmentRef: isMobile ? undefined : attachmentRef => this.setState({attachmentRef}),
      }
    }
    render() {
      return <ComposedComponent {...this.props} {...this._setters} {...this.state} />
    }
  }
  return FloatingMenuParent
}
