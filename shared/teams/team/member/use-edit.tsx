import * as Container from '../../../util/container'
type ZState = {
  editUpdatedTrigger: number
  triggerEditUpdated: () => void
}
export const useEditState = Container.createZustand(
  Container.immerZustand<ZState>(set => ({
    editUpdatedTrigger: 0,
    triggerEditUpdated: () => {
      set(state => {
        state.editUpdatedTrigger++
      })
    },
  }))
)
