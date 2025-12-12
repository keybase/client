import * as EngineGen from '@/actions/engine-gen-gen'
import type * as T from '../types'
import type * as Index from '.'
import type * as RouterType from '@/constants/router2'

const getRouterState = () => {
  const {useRouterState} = require('@/constants/router2') as typeof RouterType
  return useRouterState.getState()
}

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyFSFSOverallSyncStatusChanged:
    case EngineGen.keybase1NotifyFSFSSubscriptionNotifyPath:
    case EngineGen.keybase1NotifyFSFSSubscriptionNotify:
      {
        const {useFSState} = require('./index') as typeof Index
        useFSState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}

export const makeActionForOpenPathInFilesTab = (
  // TODO: remove the second arg when we are done with migrating to nav2
  path: T.FS.Path
) => {
  getRouterState().dispatch.navigateAppend({props: {path}, selected: 'fsRoot'})
}
