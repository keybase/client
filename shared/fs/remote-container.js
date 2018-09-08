// @flow
import * as Container from '../util/container'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'

const GetRowsFromState = (state: Container.TypedState) => state.fs.tlfUpdates.map(t => ({
  tlf: t.path,
  writer: t.writer,
  timestamp: t.serverTime,
  updates: t.history.map(u => Types.pathConcat(t.path, u.filename)),
  pathItem: state.fs.pathItems.get(t.path, Constants.unknownPathItem),
})).toJS()

export default GetRowsFromState
