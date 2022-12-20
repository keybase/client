import type {RPCError} from '../../util/errors'

export type State = {
  readonly counts: Map<string, number>
  readonly errors: Map<string, RPCError | undefined>
}
