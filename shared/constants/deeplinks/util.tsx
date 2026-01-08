import * as EngineGen from '@/actions/engine-gen-gen'
import {onEngineIncomingImpl} from './index'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyServiceHandleKeybaseLink:
      {
        onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
