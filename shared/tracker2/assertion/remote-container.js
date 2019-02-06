// @flow
import * as Container from '../../util/container'
import * as Constants from '../../constants/tracker2'
import * as I from 'immutable'
import * as Types from '../../constants/types/tracker2'
import Assertion from '.'
import openUrl from '../../util/open-url'

type State = {|
  assertions?: I.Map<string, Types.Assertion>,
|}

type OwnProps = {|
  assertionKey: string,
|}

const mapStateToProps = (state, ownProps) => {
  const a = state.assertions
    ? state.assertions.get(ownProps.assertionKey, Constants.noAssertion)
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
const mapDispatchToProps = dispatch => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  color: stateProps.color,
  isSuggestion: false,
  isYours: false, // no edit controls on tracker
  metas: stateProps._metas.map(({color, label}) => ({color, label})),
  onCopyAddress: () => dispatchProps._onCopyAddress(stateProps.value),
  onCreateProof: null,
  onRecheck: null,
  onRequestLumens: () =>
    dispatchProps._onSendOrRequestLumens(stateProps.value.split('*')[0], true, 'keybaseUser'),
  onRevoke: null,
  onSendLumens: () =>
    dispatchProps._onSendOrRequestLumens(stateProps.value.split('*')[0], false, 'keybaseUser'),
  onShowProof: () => (stateProps.proofURL ? openUrl(stateProps.proofURL) : undefined),
  onShowSite: () => (stateProps.siteURL ? openUrl(stateProps.siteURL) : undefined),
  onWhatIsStellar: () => openUrl('https://keybase.io/what-is-stellar'),
  proofURL: stateProps.proofURL,
  siteIcon: stateProps.siteIcon,
  siteURL: stateProps.siteURL,
  state: stateProps.state,
  type: stateProps.type,
  value: stateProps.value,
})

export default Container.remoteConnect<OwnProps, State, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Assertion)
