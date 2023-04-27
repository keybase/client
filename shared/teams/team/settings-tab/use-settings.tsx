import * as Container from '../../../util/container'
type ZState = {
  allowOpenTrigger: number
  triggerAllowOpen: () => void
}
// just to plumb the state, really the settings tab should change how it works, its quite
// old and creaky
export const useSettingsState = Container.createZustand(
  Container.immerZustand<ZState>(set => ({
    allowOpenTrigger: 0,
    triggerAllowOpen: () => {
      set(state => {
        state.allowOpenTrigger++
      })
    },
  }))
)
