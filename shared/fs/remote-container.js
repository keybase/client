// @flow
import * as Types from '../constants/types/fs'

type RemoteTlfUpdates = {
  timestamp: number,
  tlf: Types.Path,
  updates: Array<Types.Path>,
  writer: string,
}

const GetRowsFromTlfUpdate = (t: Types.TlfUpdate): RemoteTlfUpdates => ({
  timestamp: t.serverTime,
  tlf: t.path,
  updates: t.history.toArray().map(u => Types.stringToPath(u.filename)),
  writer: t.writer,
})

export default GetRowsFromTlfUpdate
