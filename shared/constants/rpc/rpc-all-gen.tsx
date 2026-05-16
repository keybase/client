import type {
  CustomResponseIncomingCallMap as chat1CustomResponseIncomingCallMap,
  IncomingCallMapType as chat1IncomingCallMap,
} from '@/constants/rpc/rpc-chat-gen'

import type {
  CustomResponseIncomingCallMap as keybase1CustomResponseIncomingCallMap,
  IncomingCallMapType as keybase1IncomingCallMap,
} from '@/constants/rpc/rpc-gen'

import type {
  CustomResponseIncomingCallMap as gregor1CustomResponseIncomingCallMap,
  IncomingCallMapType as gregor1IncomingCallMap,
} from '@/constants/rpc/rpc-gregor-gen'

import type {
  CustomResponseIncomingCallMap as stellar1CustomResponseIncomingCallMap,
  IncomingCallMapType as stellar1IncomingCallMap,
} from '@/constants/rpc/rpc-stellar-gen'


  export type IncomingCallMapType = chat1IncomingCallMap & keybase1IncomingCallMap & gregor1IncomingCallMap & stellar1IncomingCallMap
  export type CustomResponseIncomingCallMapType = chat1CustomResponseIncomingCallMap & keybase1CustomResponseIncomingCallMap & gregor1CustomResponseIncomingCallMap & stellar1CustomResponseIncomingCallMap
  