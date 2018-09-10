// @flow
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'

const GetRowsFromTlfUpdates = (tlfUpdates: Types.UserTlfUpdates, pathItems: Types.PathItems) => tlfUpdates.map(t => ({
  tlf: t.path,
  writer: t.writer,
  timestamp: t.serverTime,
  updates: t.history.map(u => Types.pathConcat(t.path, u.filename)),
  pathItem: pathItems.get(t.path, Constants.unknownPathItem),
})).toJS()

export default GetRowsFromTlfUpdates
