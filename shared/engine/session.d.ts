import type {
  CustomResponseIncomingCallMap as KBCustomResponseIncomingCallMap,
  IncomingCallMapType as KBIncomingCallMap,
} from '@/constants/rpc/rpc-gen'
import type {
  CustomResponseIncomingCallMap as ChatCustomResponseIncomingCallMap,
  IncomingCallMapType as ChatIncomingCallMap,
} from '@/constants/rpc/rpc-chat-gen'
import type {
  CustomResponseIncomingCallMap as GregorCustomResponseIncomingCallMap,
  IncomingCallMapType as GregorIncomingCallMap,
} from '@/constants/rpc/rpc-gregor-gen'
import type {
  CustomResponseIncomingCallMap as SellarCustomResponseIncomingCallMap,
  IncomingCallMapType as SellarIncomingCallMap,
} from '@/constants/rpc/rpc-stellar-gen'

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
  _startMethod: string | undefined
  cancel: () => void
  incomingCall: (method: string, param: object, response?: object | undefined) => boolean
  start: (method: string, param?: object | undefined, callback?: (() => void) | undefined) => void
  constructor(p: {
    sessionID: number
    incomingCallMap?: IncomingCallMap | undefined
    customResponseIncomingCallMap?: CustomResponseIncomingCallMap | undefined
    waitingKey?: string | ReadonlyArray<string> | undefined
    invoke: (method: string, param: [object] | undefined, cb: (err?: unknown, data?: unknown) => void) => void
    endHandler: (session: Session) => void
    cancelHandler?: ((session: Session) => void) | undefined
    dangling?: boolean | undefined
  })
}

export default Session

export type CancelHandlerType = (session: Session) => void
