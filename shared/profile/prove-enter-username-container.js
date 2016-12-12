// @flow
import ProveEnterUsername from './prove-enter-username'
import {TypedConnector} from '../util/typed-connect'
import {submitUsername, cancelAddProof, updateUsername, submitBTCAddress, submitZcashAddress} from '../actions/profile'
import {compose, withHandlers, withState} from 'recompose'

import type {Props} from './prove-enter-username'
import type {TypedDispatch} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {}, Props> = new TypedConnector()

export default compose(
  withState('username', 'onUsernameChange', null),
  withHandlers({
    onContinue: props => () => props.onContinue(props.username),
  }),
  connector.connect(
    (state, dispatch, ownProps) => {
      const profile = state.profile

      if (!profile.platform) {
        throw new Error('No platform passed to prove enter username')
      }

      return {
        canContinue: profile.usernameValid,
        errorCode: profile.errorCode,
        errorText: profile.errorText,
        onCancel: () => { dispatch(cancelAddProof()) },
        onContinue: (username: string) => {
          dispatch(updateUsername(username))

          if (profile.platform === 'btc') {
            dispatch(submitBTCAddress())
          } else if (profile.platform === 'zcash') {
            dispatch(submitZcashAddress())
          } else {
            dispatch(submitUsername())
          }
        },
        platform: profile.platform,
        username: profile.username,
        waiting: profile.waiting,
      }
    }
  )
)(ProveEnterUsername)
