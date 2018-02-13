// @flow
import * as I from 'immutable'
import * as Types from './types/fs'
import uuidv1 from 'uuid/v1'

export const defaultPath = '/keybase'

export const makeFolder: I.RecordFactory<Types._FolderPathItem> = I.Record({
  children: I.List(),
  progress: 'pending',
  type: 'folder',
})

export const makeFile: I.RecordFactory<Types._FilePathItem> = I.Record({
  progress: 'pending',
  type: 'file',
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  // TODO: move all these to RPC
  pathItems: I.Map([[Types.stringToPath('/keybase'), makeFolder({progress: 'pending'})]]),
})

export const makeUUID = () => uuidv1(null, Buffer.alloc(16), 0)
export const fsPathToRpcPathString = (p: Types.Path): string =>
  Types.pathToString(p).substring('/keybase'.length) || '/'
