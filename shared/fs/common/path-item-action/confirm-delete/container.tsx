import * as Constants from '../../../../constants/fs'
import * as RouterConstants from '../../../../constants/router2'
import * as React from 'react'
import type * as Types from '../../../../constants/types/fs'
import ReallyDelete from '.'

type OwnProps = {
  path: Types.Path
  mode: 'row' | 'screen'
}

export default (ownProps: OwnProps) => {
  const {path, mode} = ownProps
  const deleteFile = Constants.useState(s => s.dispatch.deleteFile)
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onBack = React.useCallback(() => navigateUp(), [navigateUp])
  const onDelete = React.useCallback(() => {
    if (path !== Constants.defaultPath) {
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
