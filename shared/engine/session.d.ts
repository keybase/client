import type {
  CustomResponseIncomingCallMap as KBCustomResponseIncomingCallMap,
  IncomingCallMapType as KBIncomingCallMap,
} from '@/constants/types/rpc-gen'
import type {
  CustomResponseIncomingCallMap as ChatCustomResponseIncomingCallMap,
  IncomingCallMapType as ChatIncomingCallMap,
} from '@/constants/types/rpc-chat-gen'
import type {
  CustomResponseIncomingCallMap as GregorCustomResponseIncomingCallMap,
  IncomingCallMapType as GregorIncomingCallMap,
} from '@/constants/types/rpc-gregor-gen'
import type {
  CustomResponseIncomingCallMap as SellarCustomResponseIncomingCallMap,
  IncomingCallMapType as SellarIncomingCallMap,
} from '@/constants/types/rpc-stellar-gen'

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
  incomingCall: (method: string, param: object, response?: object) => boolean
  start: (method: string, param?: object, callback?: () => void) => void
  constructor(p: {
    sessionID: number
    incomingCallMap?: IncomingCallMap
    customResponseIncomingCallMap?: CustomResponseIncomingCallMap
    waitingKey?: string | ReadonlyArray<string>
    invoke: (method: string, param: [object] | undefined, cb: (err?: unknown, data?: unknown) => void) => void
    endHandler: (session: Session) => void
    cancelHandler?: (session: Session) => void
    dangling?: boolean
  })
}

export default Session

export type CancelHandlerType = (session: Session) => void
