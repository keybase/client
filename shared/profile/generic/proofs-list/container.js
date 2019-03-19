// @flow
import ProofsList from '.'
import {namedConnect, type RouteProps} from '../../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  _proofSuggestions: state.tracker2.proofSuggestions,
})

const mapDispatchToProps = (dispatch, {navigateUp, onBack}: OwnProps) => ({
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onBack: dispatchProps.onBack,
  onClickLearn: () => {},
  providerClicked: (name: string) => {},
  providers: stateProps._proofSuggestions
    .filter(s => s.belowFold)
    .map(s => ({
      desc: s.pickerSubtext,
      icon: s.pickerIcon,
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
