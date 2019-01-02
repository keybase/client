// @flow
import * as Container from '../../util/container'
import * as Constants from '../../constants/profile2'
import Assertion from '.'

type OwnProps = {|
  username: string,
  assertionKey: string,
|}

const mapStateToProps = (state, ownProps) => {
  const d = state.profile2.usernameToDetails.get(ownProps.username, Constants.noDetails)
  const a = d.assertions
    ? d.assertions.get(ownProps.assertionKey, Constants.noAssertion)
    : Constants.noAssertion
  return {
    _metas: a.metas,
    color: a.color,
    proofURL: a.proofURL,
    siteIcon: a.siteIcon,
    siteURL: a.siteURL,
    state: a.state,
    type: a.type,
    value: a.value,
  }
}
const mapDispatchToProps = dispatch => ({
  // TODO
  onShowProof: () => {},
  // TODO
  onShowSite: () => {},
  // TODO
  onShowUserOnSite: () => {},
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  color: stateProps.color,
  metas: stateProps._metas.map(({color, label}) => ({color, label})),
  onClickBadge: dispatchProps.onShowProof,
  onShowProof: dispatchProps.onShowProof,
  onShowSite: dispatchProps.onShowSite,
  onShowUserOnSite: dispatchProps.onShowUserOnSite,
  proofURL: stateProps.proofURL,
  siteIcon: stateProps.siteIcon,
  siteURL: stateProps.siteURL,
  state: stateProps.state,
  type: stateProps.type,
  value: stateProps.value,
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Assertion'
)(Assertion)
