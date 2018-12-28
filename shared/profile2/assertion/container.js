// @flow
import * as Container from '../../util/container'
import * as Constants from '../../constants/profile2'
import Assertion from '.'

type OwnProps = {|
  assertion: string,
  username: string,
|}

const mapStateToProps = (state, ownProps) => {
  const d = state.profile2.usernameToDetails.get(ownProps.username, Constants.noDetails)
  const a = d.assertions ? d.assertions.get(ownProps.assertion, Constants.noAssertion) : Constants.noAssertion
  return {
    _metas: a.metas,
    proofURL: a.proofURL,
    site: a.site,
    siteIcon: a.siteIcon,
    siteURL: a.siteURL,
    state: a.state,
    username: a.username,
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
  metas: stateProps._metas.map(m => ({color: m.color, label: m.label})),
  onClickBadge: dispatchProps.onShowProof, // TODO your own profile override
  onShowProof: dispatchProps.onShowProof,
  onShowSite: dispatchProps.onShowSite,
  onShowUserOnSite: dispatchProps.onShowUserOnSite,
  proofURL: stateProps.proofURL,
  site: stateProps.site,
  siteIcon: stateProps.siteIcon,
  siteURL: stateProps.siteURL,
  state: stateProps.state,
  username: stateProps.username,
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Assertion'
)(Assertion)
