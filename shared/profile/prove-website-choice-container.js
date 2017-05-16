// @flow
import ProveWebsiteChoice from './prove-website-choice'
import {TypedConnector} from '../util/typed-connect'
import {addProof, cancelAddProof} from '../actions/profile'

import type {Props} from './prove-website-choice'
import type {TypedDispatch} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {}, Props> = new TypedConnector()

export default connector.connect((state, dispatch) => {
  return {
    // Pass https to addProof because addProof doesn't actually care if it's http/https, it will try
    // both with a preference for https
    onOptionClick: choice => {
      dispatch(addProof(choice === 'file' ? 'https' : 'dns'))
    },
    onCancel: () => {
      dispatch(cancelAddProof())
    },
  }
})(ProveWebsiteChoice)
