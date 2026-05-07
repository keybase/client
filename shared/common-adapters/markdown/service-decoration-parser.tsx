import type * as T from '@/constants/types'
import {base64ToUint8Array, uint8ArrayToString} from '@/util/uint8array'

export const parseServiceDecoration = (json: string): T.RPCChat.UITextDecoration | undefined => {
  try {
    return JSON.parse(uint8ArrayToString(base64ToUint8Array(json))) as T.RPCChat.UITextDecoration
  } catch {
    return undefined
  }
}
