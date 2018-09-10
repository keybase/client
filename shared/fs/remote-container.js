// @flow
import * as Types from '../constants/types/fs'

type RemoteTlfUpdates = {
  tlf: Types.Path,
  writer: string,
  timestamp: number,
  updates: Array<Types.Path>,
}

const GetRowsFromTlfUpdates = (tlfUpdates: Types.UserTlfUpdates): Array<RemoteTlfUpdates> => tlfUpdates.toArray().map(t => ({
  tlf: t.path,
  writer: t.writer,
  timestamp: t.serverTime,
  updates: t.history.toArray().map(u => Types.stringToPath(u.filename)),
}))

export default GetRowsFromTlfUpdates
