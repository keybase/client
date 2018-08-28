// @flow
import * as FsTypes from '../constants/types/fs'
import * as FsGen from '../actions/fs-gen'
import * as FsUtil from '../util/kbfs'
import {FilesPreview} from './files.desktop'
import {remoteConnect, compose} from '../util/container'

const mapStateToProps = (state) => ({
  _tlfRows: [
    {path: FsTypes.stringToPath('/keybase/team/zila.test/abc')},
    {path: FsTypes.stringToPath('/keybase/team/zila.test/def')},
  ],
})

const mapDispatchToProps = dispatch => ({
  _onSelectPath: (path: FsTypes.Path) => dispatch(FsGen.createOpenFilesFromWidget({path})),
  onViewAll: () => dispatch(FsGen.createOpenFilesFromWidget({})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onViewAll: dispatchProps.onViewAll,
  tlfRows: stateProps._tlfRows.map(c => ({
    onSelectPath: () => dispatchProps._onSelectPath(c.path),
    path: FsTypes.pathToString(c.path),
    ...(FsUtil.tlfToParticipantsOrTeamname(FsTypes.pathToString(c.path))),
  })),
})

export default compose(
  remoteConnect(mapStateToProps, mapDispatchToProps, mergeProps)
)(FilesPreview)
