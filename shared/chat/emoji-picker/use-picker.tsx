import * as Z from '@/util/zustand'
import type * as T from '@/constants/types'
import type {RenderableEmoji} from '@/common-adapters/emoji'

// Mailbox for handing an emoji pick back from the mobile chatChooseEmoji route
// to whichever screen pushed it. On mobile the picker is a separate routed
// screen, so its result can't come back as a callback prop (nav params must be
// serializable); on desktop the picker renders in-tree inside a popup and uses
// a plain onPickAction callback instead, bypassing this store entirely.
// Each consumer must clear its own key with updatePickerMap(key, undefined)
// once it reads a pick, so a stale value isn't replayed on the next mount.
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
type State = Store & {
  dispatch: {
    resetState: () => void
    updatePickerMap: (key: PickKey, val?: PickerValue) => void
  }
}
export const usePickerState = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
    resetState: Z.defaultReset,
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
