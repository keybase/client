// @flow
import ConfirmOrPending from './confirm-or-pending'
import {ProveCommonProofStatus} from '../constants/types/flow-types'
import {TypedConnector} from '../util/typed-connect'
import {cancelAddProof, backToProfile} from '../actions/profile'
import {globalColors} from '../styles'

import type {Props} from './confirm-or-pending'
import type {TypedDispatch} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'

const connector: TypedConnector<
  TypedState,
  TypedDispatch<{}>,
  {},
  Props
> = new TypedConnector()

export default connector.connect((state, dispatch, ownProps) => {
  const profile = state.profile
  const isGood =
    profile.proofFound && profile.proofStatus === ProveCommonProofStatus.ok
  const isPending =
    !isGood &&
    !profile.proofFound &&
    !!profile.proofStatus &&
    profile.proofStatus <= ProveCommonProofStatus.baseHardError

  if (!profile.platform) {
    throw new Error('No platform passed to confirm or pending container')
  }

  return {
    isPending,
    onCancel: () => {
      dispatch(cancelAddProof())
    },
    onReloadProfile: () => {
      dispatch(backToProfile())
    },
    platform: profile.platform,
    platformIconOverlayColor: isGood ? globalColors.green : globalColors.grey,
    titleColor: isGood ? globalColors.green : globalColors.blue,
    username: profile.username,
  }
})(ConfirmOrPending)
