import * as Z from '../../../util/zustand'
type ZState = {
  allowOpenTrigger: number
  triggerAllowOpen: () => void
}
// just to plumb the state, really the settings tab should change how it works, its quite
// old and creaky
export const useSettingsState = Z.createZustand(
  Z.immerZustand<ZState>(set => ({
    allowOpenTrigger: 0,
    triggerAllowOpen: () => {
      set(state => {
        state.allowOpenTrigger++
      })
    },
  }))
)
