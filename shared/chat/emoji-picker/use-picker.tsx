import * as Z from '../../util/zustand'
import type {RenderableEmoji} from '../../util/emoji'

export type PickKey = 'addAlias' | 'chatInput' | 'reaction'
type PickerValue = {
  emojiStr: string
  renderableEmoji: RenderableEmoji
}
type ZState = {
  pickerMap: Map<PickKey, PickerValue | undefined>
  updatePickerMap: (key: PickKey, val?: PickerValue) => void
}
export const usePickerState = Z.createZustand<ZState>(set => ({
  pickerMap: new Map(),
  updatePickerMap: (key: PickKey, val?: PickerValue) => {
    set(state => {
      state.pickerMap.set(key, val)
    })
  },
}))
