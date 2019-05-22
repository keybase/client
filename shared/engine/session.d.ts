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
declare class Session {}

export default Session

export type CancelHandlerType = (session: Session) => void
