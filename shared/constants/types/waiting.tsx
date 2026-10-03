import type * as T from '.'
import type {RPCError} from '@/util/errors'

export type State = T.Immutable<{
  counts: Map<string, number>
  errors: Map<string, RPCError | undefined>
}>
export type {WaitingKey, WaitingKeys} from '@/constants/waiting-key-type'
