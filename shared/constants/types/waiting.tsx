import type * as T from '.'
import type {RPCError} from '@/util/errors'
import type {WaitingKey} from '@/constants/waiting-key-type'

export type State = T.Immutable<{
  counts: Map<WaitingKey, number>
  errors: Map<WaitingKey, RPCError | undefined>
}>
export type {WaitingKey}
export type {WaitingKeys} from '@/constants/waiting-key-type'
