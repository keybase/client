import * as Constants from '../constants/autoreset'
import * as ConfigConstants from '../constants/config'

const initAutoReset = () => {
  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.badgeState === old.badgeState) return
    if (!s.badgeState) return
    const {resetState} = s.badgeState
    Constants.useState.getState().dispatch.updateARState(resetState.active, resetState.endTime)
  })
}

export default initAutoReset
