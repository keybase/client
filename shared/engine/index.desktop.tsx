import * as Impl from '@/engine/index-impl'
import type {RPCError} from '@/util/errors'

const getEngine = Impl.getEngine
const makeEngine = Impl.makeEngine
const Engine = Impl.Engine

export default Impl.default
export {getEngine, makeEngine, Engine}
export type BatchParams = Array<{key: string | ReadonlyArray<string>; increment: boolean; error?: RPCError}>
export type {IncomingCallMapType, CustomResponseIncomingCallMapType} from '@/constants/rpc/rpc-all-gen'
