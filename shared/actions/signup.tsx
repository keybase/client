import * as EngineGen from './engine-gen-gen'
import * as Router2Constants from '../constants/router2'
import * as Tabs from '../constants/tabs'
import * as Constants from '../constants/signup'
import * as RouteTreeGen from './route-tree-gen'
import * as Container from '../util/container'

const initSignup = () => {
  Container.listenAction(RouteTreeGen.onNavChanged, (_, action) => {
    const {prev, next} = action.payload
    // Clear "just signed up email" when you leave the people tab after signup
    if (
      Constants.useState.getState().justSignedUpEmail &&
      prev &&
      Router2Constants.getTab(prev) === Tabs.peopleTab &&
      next &&
      Router2Constants.getTab(next) !== Tabs.peopleTab
    ) {
      Constants.useState.getState().dispatch.clearJustSignedUpEmail()
    }
  })

  Container.listenAction(EngineGen.keybase1NotifyEmailAddressEmailAddressVerified, () => {
    Constants.useState.getState().dispatch.clearJustSignedUpEmail()
  })
}

export default initSignup
