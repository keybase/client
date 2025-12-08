import * as EngineGen from '@/actions/engine-gen-gen'
import type * as Index from '.'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyServiceHandleKeybaseLink:
      {
        const {useState} = require('.') as typeof Index
        useState.getState().dispatch.onEngineIncoming(action)
      }
      break
    default:
  }
}
