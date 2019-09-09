import * as Container from '../util/container'
import * as PushGen from '../actions/push-gen'
import * as Types from '../constants/types/push'

const initialState: Types.State = {
  hasPermissions: true,
  showPushPrompt: false,
  token: '',
}

export default (state: Types.State = initialState, action: PushGen.Actions): Types.State =>
  Container.produce(state, (draftState: Container.Draft<Types.State>) => {
    switch (action.type) {
      case PushGen.resetStore:
        // when you sign out we need to keep all this info as its per device
        return
      case PushGen.rejectPermissions:
        draftState.hasPermissions = false
        draftState.showPushPrompt = false
        return
      case PushGen.updateHasPermissions:
        draftState.hasPermissions = action.payload.hasPermissions
        return
      case PushGen.showPermissionsPrompt:
        draftState.showPushPrompt = action.payload.show
        return
      case PushGen.updatePushToken:
        draftState.token = action.payload.token
        return
      // Saga only actions
      case PushGen.requestPermissions:
      case PushGen.notification:
        return
    }
  })
