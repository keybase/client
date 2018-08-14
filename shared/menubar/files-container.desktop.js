// @flow
import * as ConfigGen from '../actions/config-gen'
import * as Tabs from '../constants/tabs'
import * as FsTypes from '../constants/types/fs'
// TODO: uncomment when we have the right thing
// import * as FsGen from '../actions/fs-gen'
import {switchTo} from '../actions/route-tree'
import {FilesPreview} from './files.desktop'
import {connect, compose, type Dispatch} from '../util/container'

const mapStateToProps = (state) => ({
  _tlfRows: [
    {path: FsTypes.stringToPath('/keybase/team/zila.test/abc')},
    {path: FsTypes.stringToPath('/keybase/team/zila.test/def')},
  ],
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onViewAll: () => {
    dispatch(ConfigGen.createShowMain())
    dispatch(switchTo([Tabs.fsTab]))
  },
  _onSelectPath: (path: FsTypes.Path) => {
    dispatch(ConfigGen.createShowMain())
    dispatch(switchTo([Tabs.fsTab]))
    // TODO: uncomment when we have the right thing
    // dispatch(FsGen)
  },
})

const mergeProps = (stateProps, dispatchProps) => ({
  onViewAll: dispatchProps.onViewAll,
  tlfRows: stateProps._tlfRows.map(c => ({
    onSelectConversation: () => dispatchProps._onSelectPath(c.path),
    ...c,
  })),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps)
)(FilesPreview)
