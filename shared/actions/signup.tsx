import * as EngineGen from './engine-gen-gen'
import * as RouterConstants from '../constants/router2'
import * as Tabs from '../constants/tabs'
import * as Constants from '../constants/signup'
import * as Container from '../util/container'

const initSignup = () => {
  RouterConstants.useState.subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return
    // Clear "just signed up email" when you leave the people tab after signup
    if (
      Constants.useState.getState().justSignedUpEmail &&
      prev &&
      RouterConstants.getTab(prev) === Tabs.peopleTab &&
      next &&
      RouterConstants.getTab(next) !== Tabs.peopleTab
    ) {
      Constants.useState.getState().dispatch.clearJustSignedUpEmail()
    }
  })

  Container.listenAction(EngineGen.keybase1NotifyEmailAddressEmailAddressVerified, () => {
    Constants.useState.getState().dispatch.clearJustSignedUpEmail()
  })
}

export default initSignup
