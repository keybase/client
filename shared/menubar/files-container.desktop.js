// @flow
import * as React from 'react'
import * as FsTypes from '../constants/types/fs'
import * as FsGen from '../actions/fs-gen'
import * as FsUtil from '../util/kbfs'
import * as FsConstants from '../constants/fs'
import * as TimestampUtil from '../util/timestamp'
import {type RemoteTlfUpdates} from '../fs/remote-container'
import {FilesPreview, type UserTlfUpdateRowProps} from './files.desktop'
import {remoteConnect, setDisplayName} from '../util/container'
import * as SafeElectron from '../util/safe-electron.desktop'
import {throttle} from 'lodash'

type State = {|
  username: string,
  fileRows: Array<RemoteTlfUpdates>,
|}

const mapStateToProps = (state: State) => ({
  _username: state.username,
  _userTlfUpdates: state.fileRows,
})

const mapDispatchToProps = dispatch => ({
  _onSelectPath: (path: FsTypes.Path, type: FsTypes.PathType) =>
    dispatch(FsGen.createOpenFilesFromWidget({path, type})),
  loadTlfUpdates: () => dispatch(FsGen.createUserFileEditsLoad()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  loadTlfUpdates: dispatchProps.loadTlfUpdates,
  userTlfUpdates: stateProps._userTlfUpdates.map(c => {
    const tlf = FsTypes.pathToString(c.tlf)
    const {participants, teamname} = FsUtil.tlfToParticipantsOrTeamname(tlf)
    const iconSpec = FsConstants.getIconSpecFromUsernamesAndTeamname([c.writer], null, stateProps._username)
    const tlfType = FsTypes.getPathVisibility(c.tlf) || 'private'
    return {
      onSelectPath: () => dispatchProps._onSelectPath(c.tlf, 'folder'),
      tlf,
      // Default to private visibility--this should never happen though.
      tlfType,
      writer: c.writer,
      participants: participants || [],
      teamname: teamname || '',
      iconSpec,
      timestamp: TimestampUtil.formatTimeForConversationList(c.timestamp),
      updates: c.updates.map(({path, uploading}) => ({
        tlfType,
        name: FsTypes.getPathName(path),
        uploading,
        onClick: () => dispatchProps._onSelectPath(path, 'file'),
      })),
    }
  }),
})

type TlfUpdateHocProps = {|
  loadTlfUpdates: () => void,
  userTlfUpdates: Array<UserTlfUpdateRowProps>,
|}

const TlfUpdateHoc = (ComposedComponent: React.ComponentType<any>) =>
  class extends React.PureComponent<TlfUpdateHocProps> {
    _refresh = throttle(() => this.props.loadTlfUpdates(), 1000 * 5)
    componentDidMount = () => {
      SafeElectron.getRemote()
        .getCurrentWindow()
        .on('show', this._refresh)
    }
    render() {
      return <ComposedComponent {...this.props} />
    }
  }

export default ((ComposedComponent: React.ComponentType<any>) =>
  remoteConnect<{||}, State, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps)(
    setDisplayName('FilesPreview')(TlfUpdateHoc(ComposedComponent))
  ))(FilesPreview)
