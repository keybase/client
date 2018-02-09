// @flow
import * as I from 'immutable'
import * as Types from './types/fs'
import {Buffer} from 'buffer'
import uuidv1 from 'uuid/v1'
import * as FsGen from '../actions/fs-gen'
import {type Dispatch} from '../util/container'

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
  pathItems: I.Map([
    [
      Types.stringToPath('/keybase'),
      makeFolder({
        children: I.List(['private', 'public', 'team']),
      }),
    ],
    [Types.stringToPath('/keybase/private'), makeFolder()],
    [Types.stringToPath('/keybase/public'), makeFolder()],
    [Types.stringToPath('/keybase/team'), makeFolder()],
  ]),
})

export const makeUUID = () => uuidv1(null, Buffer.alloc(16), 0)
export const wrapOpID = (actionCreator, payload) =>
  actionCreator({
    opID: makeUUID(),
    ...payload,
  })
export const dispatchFolderListLoad = (dispatch: Dispatch, path: string) =>
  dispatch(wrapOpID(FsGen.createFolderListLoad, {path: path}))
