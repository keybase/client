import * as Types from '../constants/types/fs'

export type RemoteTlfUpdates = {
  timestamp: number
  tlf: Types.Path
  updates: Array<{
    path: Types.Path
    uploading: boolean
  }>
  writer: string
}

const GetRowsFromTlfUpdate = (t: Types.TlfUpdate, uploads: Types.Uploads): RemoteTlfUpdates => ({
  timestamp: t.serverTime,
  tlf: t.path,

  updates: t.history.toArray().map(u => {
    const path = Types.stringToPath(u.filename)
    return {
      path,
      uploading: uploads.syncingPaths.has(path) || uploads.writingToJournal.has(path),
    }
  }),

  writer: t.writer,
})

export default GetRowsFromTlfUpdate
