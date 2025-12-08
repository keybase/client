import * as EngineGen from '@/actions/engine-gen-gen'
import type * as Index from '.'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyServiceHandleKeybaseLink:
      {
        const {useDeepLinksState} = require('.') as typeof Index
        useDeepLinksState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
