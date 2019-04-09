// @flow
import {namedConnect, type RouteProps} from '../../../util/container'
import * as ProfileGen from '../../../actions/profile-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import ProofsList from '.'
import openURL from '../../../util/open-url'
import {flatten, partition, identity} from 'lodash-es'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _proofSuggestions: state.tracker2.proofSuggestions,
})

const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  providerClicked: (key: string) => dispatch(ProfileGen.createAddProof({platform: key})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onCancel: dispatchProps.onCancel,
  onClickLearn: () => openURL('https://keybase.io/docs/proof_integration_guide'),
  providerClicked: dispatchProps.providerClicked,
  providers: promoteNew(
    stateProps._proofSuggestions
      .map(s => ({
        desc: s.pickerSubtext,
        icon: s.pickerIcon,
        key: s.assertionKey,
        name: s.pickerText,
        new: s.metas.some(({label}) => label === 'new'),
      }))
      .toArray()
  ),
  title: 'Prove your...',
})

const promoteNew = rows => {
  return flatten(partition(rows, 'new').map(identity))
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ProofsList'
)(ProofsList)
