import * as C from '../../../constants'
import * as React from 'react'
import Confirm, {type Props} from './confirm'
import type * as Types from '../../../constants/types/fs'
import type {FloatingMenuProps} from './types'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  path: Types.Path
}

export default (ownProps: OwnProps) => {
  const {path} = ownProps
  const _pathItemActionMenu = C.useFSState(s => s.pathItemActionMenu)
  const size = C.useFSState(s => C.getPathItem(s.pathItems, path).size)

  const setPathItemActionMenuView = C.useFSState(s => s.dispatch.setPathItemActionMenuView)
  const download = C.useFSState(s => s.dispatch.download)
  const _confirm = React.useCallback(
    ({view, previousView}: any) => {
      download(path, view === 'confirm-save-media' ? 'saveMedia' : 'share')
      setPathItemActionMenuView(previousView)
    },
    [setPathItemActionMenuView, download, path]
  )
  const props = {
    ...ownProps,
    action:
      _pathItemActionMenu.view === 'confirm-save-media'
        ? 'save-media'
        : ('send-to-other-app' as Props['action']),
    confirm: () => _confirm(_pathItemActionMenu),
    size,
  }
  return <Confirm {...props} />
}
