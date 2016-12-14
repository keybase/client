// @flow
import ProveEnterUsername from './prove-enter-username'
import {connect} from 'react-redux'
import {submitUsername, cancelAddProof, updateUsername, submitBTCAddress, submitZcashAddress} from '../actions/profile'

import type {Props} from './prove-enter-username'
import type {TypedDispatch} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'

type OwnProps = {}

export default connect(
  (state: TypedState, ownProps: OwnProps) => {
    const profile = state.profile

    if (!profile.platform) {
      throw new Error('No platform passed to prove enter username')
    }

    return {
      canContinue: profile.usernameValid,
      errorCode: profile.errorCode,
      errorText: profile.errorText,
      platform: profile.platform,
      username: profile.username,
      waiting: profile.waiting,
    }
  },
  (dispatch: TypedDispatch<*>, ownProps: OwnProps) => ({
    onCancel: () => { dispatch(cancelAddProof()) },
    onUsernameChange: (username: string) => { dispatch(updateUsername(username)) },
    onContinue: (username: string, platform: ?string) => {
      dispatch(updateUsername(username))

      if (platform === 'btc') {
        dispatch(submitBTCAddress())
      } else if (platform === 'zcash') {
        dispatch(submitZcashAddress())
      } else {
        dispatch(submitUsername())
      }
    },
  }),
  (stateProps, dispatchProps, ownProps): Props => ({
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    onContinue: (username: string) => dispatchProps.onContinue(username, stateProps.platform),
  })
)(ProveEnterUsername)
