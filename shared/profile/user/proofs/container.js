// @flow
import ProofsList from '.'
import {namedConnect, type RouteProps} from '../../../util/container'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => {}

const mapDispatchToProps = (dispatch, {navigateUp, onBack}: OwnProps) => ({
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  filter: '',
  onBack: dispatchProps.onBack,
  onClickLearn: () => {},
  onSetFilter: (filter: string) => {},
  providerClicked: (name: string) => {},
  providers: [],
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ProofsList'
)(ProofsList)
