import {RPCError} from '../../util/errors'

export type State = Readonly<{
  counts: Map<string, number>
  errors: Map<string, RPCError | undefined>
}>
