// @flow
import * as React from 'react'
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../../util/container'
import {Text} from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import TextView from './text-view'

const mapStateToProps = (state: TypedState, {path}) => {
  return {
    path,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {path} = stateProps
  const fileType = Types.inferFileTypeFromName(Types.getPathName(path))
  return {
    path,
    fileType,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('FilePreviewFileView')
)(({path, fileType}) => {
  switch (fileType) {
    case 'text':
      return <TextView url="https://keybase.io/warp/release.txt" />
    case 'unknown':
      // This is already handled in fs/filepreview/index.js.
      return <Text type="BodyError">This shouldn't happen</Text>
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(fileType: empty) // this breaks when a new file type is added but not handled here
  }
})
