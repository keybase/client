import {
  CustomResponseIncomingCallMap as KBCustomResponseIncomingCallMap,
  IncomingCallMapType as KBIncomingCallMap,
} from '../constants/types/rpc-gen'
import {
  CustomResponseIncomingCallMap as ChatCustomResponseIncomingCallMap,
  IncomingCallMapType as ChatIncomingCallMap,
} from '../constants/types/rpc-chat-gen'
import {
  CustomResponseIncomingCallMap as GregorCustomResponseIncomingCallMap,
  IncomingCallMapType as GregorIncomingCallMap,
} from '../constants/types/rpc-gregor-gen'
import {
  CustomResponseIncomingCallMap as SellarCustomResponseIncomingCallMap,
  IncomingCallMapType as SellarIncomingCallMap,
} from '../constants/types/rpc-stellar-gen'

type IncomingCallMap = {} & KBIncomingCallMap &
  ChatIncomingCallMap &
  GregorIncomingCallMap &
  SellarIncomingCallMap
type CustomResponseIncomingCallMap = {} & KBCustomResponseIncomingCallMap &
  ChatCustomResponseIncomingCallMap &
  GregorCustomResponseIncomingCallMap &
  SellarCustomResponseIncomingCallMap
declare class Session {
  id: number
  getId: () => number
  end: () => void
  getDangling: () => boolean
  hasSeqID: (seqID: number) => boolean
  _startMethod: string | null
  cancel: () => void
  incomingCall: (method: string, param: Object, response: Object | null) => boolean
  start: (method: string, param: Object | null, callback: null | (() => void)) => void
  constructor(arg0: {
    sessionID: number
    incomingCallMap?: IncomingCallMap | null
    customResponseIncomingCallMap?: CustomResponseIncomingCallMap | null
    waitingKey?: string | Array<string>
    invoke: (method: string, param: [Object] | null, cb: (err?: any, data?: any) => void) => void
    endHandler: (session: Session) => void
    cancelHandler?: (session: Session) => void
    dangling?: boolean
  })
}

export default Session

export type CancelHandlerType = (session: Session) => void
