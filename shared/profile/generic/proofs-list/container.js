// @flow
import {namedConnect, type RouteProps} from '../../../util/container'
import * as ProfileGen from '../../../actions/profile-gen'
import ProofsList from '.'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _proofSuggestions: state.tracker2.proofSuggestions,
})

const mapDispatchToProps = (dispatch, {navigateUp, onBack}: OwnProps) => ({
  onBack: () => dispatch(navigateUp()),
  providerClicked: (key: string) => dispatch(ProfileGen.createAddGenericProof({platform: key})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onBack: dispatchProps.onBack,
  onClickLearn: () => {},
  providerClicked: dispatchProps.providerClicked,
  providers: stateProps._proofSuggestions
    .map(s => ({
      desc: s.pickerSubtext,
      icon: s.pickerIcon,
      key: s.assertionKey,
      name: s.pickerText,
      new: false, // TODO
    }))
    .toArray(),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ProofsList'
)(ProofsList)
