import * as Z from '@/util/zustand'
import type * as T from '@/constants/types'
import type {RenderableEmoji} from '@/util/emoji'

export type PickKey = 'addAlias' | 'chatInput' | 'reaction'
type PickerValue = {
  emojiStr: string
  renderableEmoji: RenderableEmoji
}
type Store = T.Immutable<{
  pickerMap: Map<PickKey, PickerValue | undefined>
}>
const initialStore: Store = {
  pickerMap: new Map(),
}
interface State extends Store {
  dispatch: {
    resetState: 'default'
    updatePickerMap: (key: PickKey, val?: PickerValue) => void
  }
}
export const usePickerState = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
    resetState: 'default',
    updatePickerMap: (key, val) => {
      set(state => {
        state.pickerMap.set(key, val)
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
