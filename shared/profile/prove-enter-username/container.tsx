import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import ProveEnterUsername from '.'

type OwnProps = {}
export default Container.connect(
  state => {
    const profile = state.profile

    if (!profile.platform) {
      throw new Error('No platform passed to prove enter username')
    }

    return {
      errorText: profile.errorText === 'Input canceled' ? '' : profile.errorText,
      platform: profile.platform,
      title: 'Add Proof',
      username: profile.username,
    }
  },
  dispatch => ({
    _onSubmit: (username: string, platform: string | null) => {
      dispatch(ProfileGen.createUpdateUsername({username}))

      if (platform === 'btc') {
        dispatch(ProfileGen.createSubmitBTCAddress())
      } else if (platform === 'zcash') {
        dispatch(ProfileGen.createSubmitZcashAddress())
      } else {
        dispatch(ProfileGen.createSubmitUsername())
      }
    },
    onCancel: () => {
      dispatch(ProfileGen.createCancelAddProof())
      dispatch(RouteTreeGen.createClearModals())
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    errorText: stateProps.errorText,
    onCancel: dispatchProps.onCancel,
    onSubmit: (username: string) => dispatchProps._onSubmit(username, stateProps.platform),
    platform: stateProps.platform,
    username: stateProps.username,
  })
)(ProveEnterUsername)
