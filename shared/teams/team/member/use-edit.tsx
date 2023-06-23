import * as Z from '../../../util/zustand'
type ZState = {
  editUpdatedTrigger: number
  triggerEditUpdated: () => void
}
export const useEditState = Z.createZustand(
  Z.immerZustand<ZState>(set => ({
    editUpdatedTrigger: 0,
    triggerEditUpdated: () => {
      set(state => {
        state.editUpdatedTrigger++
      })
    },
  }))
)
