import * as C from '../../../../constants'
import * as React from 'react'
import type * as T from '../../../../constants/types'
import ReallyDelete from '.'

type OwnProps = {
  path: T.FS.Path
  mode: 'row' | 'screen'
}

export default (ownProps: OwnProps) => {
  const {path, mode} = ownProps
  const deleteFile = C.useFSState(s => s.dispatch.deleteFile)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = navigateUp
  const onDelete = React.useCallback(() => {
    if (path !== C.defaultPath) {
      deleteFile(path)
    }
    // If this is a screen menu, then we're deleting the folder we're in,
    // and we need to navigate up twice.
    if (mode === 'screen') {
      navigateUp()
      navigateUp()
    } else {
      navigateUp()
    }
  }, [deleteFile, navigateUp, mode, path])
  const props = {
    onBack,
    onDelete,
    path,
    title: 'Confirmation',
  }
  return <ReallyDelete {...props} />
}
