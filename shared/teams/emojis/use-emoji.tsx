import * as Container from '../../util/container'
type ZState = {
  emojiUpdatedTrigger: number
  triggerEmojiUpdated: () => void
}
export const useEmojiState = Container.createZustand(
  Container.immerZustand<ZState>(set => ({
    emojiUpdatedTrigger: 0,
    triggerEmojiUpdated: () => {
      set(state => {
        state.emojiUpdatedTrigger++
      })
    },
  }))
)
