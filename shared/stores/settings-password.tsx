import * as Z from '@/util/zustand'
import {ignorePromise} from '@/constants/utils'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import * as T from '@/constants/types'

type Store = T.Immutable<{
  randomPW?: boolean
}>

const initialStore: Store = {
  randomPW: undefined,
}

export type State = Store & {
  dispatch: {
    loadHasRandomPw: () => void
    notifyUsersPasswordChanged: (randomPW: boolean) => void
    resetState: () => void
  }
}

export const usePWState = Z.createZustand<State>('settings-password', (set, get) => {
  const dispatch: State['dispatch'] = {
    loadHasRandomPw: () => {
      // Once loaded, do not issue this RPC again. This field can only go true ->
      // false (never the opposite way), and there are notifications set up when
      // this happens.
      const f = async () => {
        if (get().randomPW !== undefined) {
          return
        }
        try {
          const passphraseState = await T.RPCGen.userLoadPassphraseStateRpcPromise()
          const randomPW = passphraseState === T.RPCGen.PassphraseState.random
          set(s => {
            s.randomPW = randomPW
          })
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.warn('Error loading hasRandomPW:', error.message)
          return
        }
      }
      ignorePromise(f())
    },
    notifyUsersPasswordChanged: randomPW => {
      set(s => {
        s.randomPW = randomPW
      })
    },
    resetState: Z.defaultReset,
  }
  return {
    ...initialStore,
    dispatch,
  }
})
