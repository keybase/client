import {namedConnect, RouteProps} from '../../../util/container'
import * as ProfileGen from '../../../actions/profile-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import ProofsList from '.'
import openURL from '../../../util/open-url'

type OwnProps = RouteProps

const mapStateToProps = state => ({
  _proofSuggestions: state.tracker2.proofSuggestions,
})

const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  providerClicked: (key: string) => dispatch(ProfileGen.createAddProof({platform: key, reason: 'profile'})),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  onCancel: dispatchProps.onCancel,
  onClickLearn: () => openURL('https://keybase.io/docs/proof_integration_guide'),
  providerClicked: dispatchProps.providerClicked,
  providers: stateProps._proofSuggestions
    .map(s => ({
      desc: s.pickerSubtext,
      icon: s.pickerIcon,
      key: s.assertionKey,
      name: s.pickerText,
      new: s.metas.some(({label}) => label === 'new'),
    }))
    .toArray(),
  title: 'Prove your...',
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ProofsList')(ProofsList)
