import * as Container from '../util/container'
import * as Types from '../constants/types/autoreset'
import * as AutoresetGen from '../actions/autoreset-gen'

const initialState: Types.State = {
  autoreset: 'coming soon',
}

export default (state: Types.State = initialState, action: AutoresetGen.Actions): Types.State =>
  Container.produce(state, (draftState: Types.State) => {
    switch (action.type) {
      case AutoresetGen.resetStore:
        return initialState
      case AutoresetGen.dummy:
        return draftState
      default:
        Container.assertNever(action)
        return draftState
    }
  })
