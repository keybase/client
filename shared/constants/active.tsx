import * as C from '.'
import type * as T from './types'
import * as Z from '@/util/zustand'

type Store = T.Immutable<{active: boolean}>
const initialStore: Store = {active: true}

interface State extends Store {
  dispatch: {
    resetState: 'default'
    setActive: (a: boolean) => void
  }
}
export const _useState = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
    resetState: 'default',
    setActive: a => {
      set(s => {
        s.active = a
      })
      const cs = C.getConvoState(C.Chat.getSelectedConversation())
      cs.dispatch.markThreadAsRead()
    },
  }
  return {...initialStore, dispatch}
})
