// @flow
import * as React from 'react'
import {namedConnect} from '../../util/container'
import * as RowTypes from '../row/types'
import SortBar, {height} from './sortbar'
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'

type OwnProps = {
  path: Types.Path,
}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _loadingPaths: state.fs.loadingPaths,
  _sortSetting: state.fs.pathUserSettings.get(path, Constants.defaultPathUserSetting).sort,
})

const mapDispatchToProps = (dispatch, {path}) => ({
  sortByNameAsc:
    path === Constants.defaultPath
      ? undefined
      : () => dispatch(FsGen.createSortSetting({path, sortSetting: 'name-asc'})),
  sortByNameDesc:
    path === Constants.defaultPath
      ? undefined
      : () => dispatch(FsGen.createSortSetting({path, sortSetting: 'name-desc'})),
  sortByTimeAsc:
    Types.getPathLevel(path) < 3
      ? undefined
      : () => dispatch(FsGen.createSortSetting({path, sortSetting: 'time-asc'})),
  sortByTimeDesc:
    Types.getPathLevel(path) < 3
      ? undefined
      : () => dispatch(FsGen.createSortSetting({path, sortSetting: 'time-desc'})),
})

const emptySet = I.Set()

const mergeProps = (stateProps, dispatchProps, {path}: OwnProps) => ({
  folderIsPending: stateProps._loadingPaths.get(path, emptySet).size > 0,
  sortSetting: path === Constants.defaultPath ? undefined : stateProps._sortSetting,
  ...dispatchProps,
})

const ConnectedSortBar = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SortBar'
)(SortBar)

export default ConnectedSortBar

export const asRows = (path: Types.Path): Array<RowTypes.RowItemWithKey> => [
  {
    height,
    key: 'sort-bar',
    node: <ConnectedSortBar path={path} />,
    rowType: 'header',
  },
] // We always show this, but just fill with blank at /keybase
