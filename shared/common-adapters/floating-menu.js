// @flow
import * as React from 'react'
import FloatingBox from './floating-box'
import type {Position} from './relative-popup-hoc'
import PopupMenu, {type MenuItem, ModalLessPopupMenu} from './popup-menu'
import {isMobile} from '../constants/platform'
import {compose, withProps, withStateHandlers} from '../util/container'

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
  setAttachmentRef: (?React.Component<*, *>) => void,
  setShowingMenu: boolean => void,
  toggleShowingMenu: () => void,
}

// TODO mock this for storybook w/ actions
export const FloatingMenuParentHOC = compose(
  withStateHandlers(
    {attachmentRef: null, showingMenu: false},
    {
      _setAttachmentRef: () => attachmentRef => ({attachmentRef}),
      setShowingMenu: () => showingMenu => ({showingMenu}),
      toggleShowingMenu: ({showingMenu}) => () => ({showingMenu: !showingMenu}),
    }
  ),
  // using withProps so we can set it to undefined on mobile
  // while keeping flow / recompose happy
  withProps(({_setAttachmentRef}) => ({
    setAttachmentRef: isMobile ? undefined : _setAttachmentRef,
  }))
)
