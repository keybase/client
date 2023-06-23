import * as Z from '../../util/zustand'
type ZState = {
  emojiUpdatedTrigger: number
  triggerEmojiUpdated: () => void
}
export const useEmojiState = Z.createZustand(
  Z.immerZustand<ZState>(set => ({
    emojiUpdatedTrigger: 0,
    triggerEmojiUpdated: () => {
      set(state => {
        state.emojiUpdatedTrigger++
      })
    },
  }))
)
