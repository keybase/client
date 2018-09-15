// @flow
import * as Constants from '../../constants/fs'
import * as FsGen from '../fs-gen'

export const makeRetriableErrorHandler = (action: FsGen.Actions) => (error: any): FsGen.FsErrorPayload =>
  FsGen.createFsError({
    error: Constants.makeError({
      error,
      erroredAction: action,
      retriableAction: action,
    }),
  })

export const makeUnretriableErrorHandler = (action: FsGen.Actions) => (error: any): FsGen.FsErrorPayload =>
  FsGen.createFsError({
    error: Constants.makeError({
      error,
      erroredAction: action,
    }),
  })
