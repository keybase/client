// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {ModalLessPopupMenu} from '../../common-adapters/popup-menu.desktop'

type PopupMenuProps = {
  items: Array<Types.PathBreadcrumbItem>,
  isTeamPath: boolean,
  onOpenBreadcrumb: (path: string) => void,
}

export const DropdownPopupMenu = ({items, isTeamPath, onOpenBreadcrumb}: PopupMenuProps) => {
  const popupItems = items.map(i => ({
    onClick: () => {
      onOpenBreadcrumb(i.path)
    },
    title: i.name,
  }))
  return <ModalLessPopupMenu items={popupItems} onHidden={() => {}} style={stylePopup} />
}

const stylePopup = {
  overflow: 'visible',
  width: 196,
  marginLeft: -10,
}
