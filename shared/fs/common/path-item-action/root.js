// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Kb from '../../../common-adapters'
import type {FloatingMenuProps} from './types'
import {fileUIName} from '../../../constants/platform'
import Header from './header-container'

type Props = {|
  floatingMenuProps: FloatingMenuProps,
  path: Types.Path,
  // Menu items
  showInSystemFileManager?: () => void,
  ignoreFolder?: () => void,
  share?: () => void,
  download?: () => void,
  copyPath?: () => void,
  deleteFileOrFolder?: () => void,
  moveOrCopy?: () => void,
|}

const hideMenuOnClick = (onClick: (evt?: SyntheticEvent<>) => void, hideMenu: () => void) => (
  evt?: SyntheticEvent<>
) => {
  onClick(evt)
  hideMenu()
}

const makeMenuItems = (props: Props, hideMenu: () => void) => [
  ...(props.showInSystemFileManager
    ? [
        {
          onClick: hideMenuOnClick(props.showInSystemFileManager, hideMenu),
          title: 'Show in ' + fileUIName,
        },
      ]
    : []),
  ...(props.share
    ? [
        {
          onClick: props.share,
          title: 'Share',
        },
      ]
    : []),
  ...(props.copyPath
    ? [
        {
          onClick: hideMenuOnClick(props.copyPath, hideMenu),
          title: 'Copy path',
        },
      ]
    : []),
  ...(props.download
    ? [
        {
          onClick: hideMenuOnClick(props.download, hideMenu),
          title: 'Download a copy',
        },
      ]
    : []),
  ...(props.ignoreFolder
    ? [
        {
          danger: true,
          onClick: hideMenuOnClick(props.ignoreFolder, hideMenu),
          subTitle: 'The folder will no longer appear in your folders list.',
          title: 'Ignore this folder',
        },
      ]
    : []),
  ...(props.moveOrCopy
    ? [
        {
          onClick: hideMenuOnClick(props.moveOrCopy, hideMenu),
          title: 'Move or Copy',
        },
      ]
    : []),
  ...(props.deleteFileOrFolder
    ? [
        {
          danger: true,
          onClick: hideMenuOnClick(props.deleteFileOrFolder, hideMenu),
          title: 'Delete',
        },
      ]
    : []),
]

export default (props: Props) => (
  <Kb.FloatingMenu
    closeOnSelect={false}
    containerStyle={props.floatingMenuProps.containerStyle}
    attachTo={props.floatingMenuProps.attachTo}
    visible={props.floatingMenuProps.visible}
    onHidden={props.floatingMenuProps.hideOnce}
    position="bottom right"
    header={{
      title: 'unused',
      view: <Header path={props.path} />,
    }}
    items={makeMenuItems(props, props.floatingMenuProps.hideOnce)}
  />
)
