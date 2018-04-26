// @flow
import * as React from 'react'
import FloatingBox from './floating-box'
import type {Position} from './relative-popup-hoc'
import PopupMenu, {type MenuItem, ModalLessPopupMenu} from './popup-menu'
import {isMobile} from '../constants/platform'

export type Props = {
  closeOnSelect?: boolean,
  items: Array<MenuItem | 'Divider' | null>,
  header?: MenuItem,
  onHidden: () => void,
  visible: boolean,
  attachTo?: ?React.Component<*, *>,
  position?: Position,
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
  attachmentRef: ?React.Component<*, *>,
  showingMenu: boolean,
  setAttachmentRef: ?(?React.Component<*, *>) => void,
  setShowingMenu: boolean => void,
  toggleShowingMenu: () => void,
}

type State = {
  attachmentRef: ?React.Component<*, *>,
  showingMenu: boolean,
}

type Callbacks = {
  setShowingMenu: boolean => void,
  toggleShowingMenu: () => void,
  setAttachmentRef: ?(?React.Component<*, *>) => void,
}

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
        toggleShowingMenu: () => this.setState(oldState => ({showingMenu: !oldState.showingMenu})),
        setAttachmentRef: isMobile ? undefined : attachmentRef => this.setState({attachmentRef}),
      }
    }
    render() {
      return <ComposedComponent {...this.props} {...this._setters} {...this.state} />
    }
  }
  return FloatingMenuParent
}
