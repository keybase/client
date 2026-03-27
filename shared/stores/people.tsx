import type * as EngineGen from '@/constants/rpc'
import {ignorePromise, RPCError, isNetworkErr} from '@/constants/utils'
import logger from '@/logger'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'

type Store = T.Immutable<{
  refreshCount: number
}>

const initialStore: Store = {
  refreshCount: 0,
}

export type State = Store & {
  dispatch: {
    markViewed: () => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    resetState: () => void
  }
}

export const usePeopleState = Z.createZustand<State>('people', set => {
  const dispatch: State['dispatch'] = {
    markViewed: () => {
      const f = async () => {
        try {
          await T.RPCGen.homeHomeMarkViewedRpcPromise()
        } catch (error) {
          if (!(error instanceof RPCError)) {
            throw error
          }
          if (isNetworkErr(error.code)) {
            logger.warn('Network error calling homeMarkViewed')
          } else {
            throw error
          }
        }
      }
      ignorePromise(f())
    },
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case 'keybase.1.homeUI.homeUIRefresh':
          set(s => {
            s.refreshCount++
          })
          break
        default:
      }
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
      }))
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})
