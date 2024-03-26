import * as C from '@/constants'
import * as React from 'react'
import Confirm, {type Props} from './confirm'
import * as T from '@/constants/types'
import type {FloatingMenuProps} from './types'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  path: T.FS.Path
}

const Container = (ownProps: OwnProps) => {
  const {path} = ownProps
  const _pathItemActionMenu = C.useFSState(s => s.pathItemActionMenu)
  const size = C.useFSState(s => C.FS.getPathItem(s.pathItems, path).size)

  const setPathItemActionMenuView = C.useFSState(s => s.dispatch.setPathItemActionMenuView)
  const download = C.useFSState(s => s.dispatch.download)
  const _confirm = React.useCallback(
    ({view, previousView}: typeof _pathItemActionMenu) => {
      download(path, view === T.FS.PathItemActionMenuView.ConfirmSaveMedia ? 'saveMedia' : 'share')
      setPathItemActionMenuView(previousView)
    },
    [setPathItemActionMenuView, download, path]
  )
  const props = {
    ...ownProps,
    action:
      _pathItemActionMenu.view === T.FS.PathItemActionMenuView.ConfirmSaveMedia
        ? 'save-media'
        : ('send-to-other-app' as Props['action']),
    confirm: () => _confirm(_pathItemActionMenu),
    size,
  }
  return <Confirm {...props} />
}

export default Container
