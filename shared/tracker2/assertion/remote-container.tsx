import * as Container from '../../util/container'
import * as Constants from '../../constants/tracker2'
import Assertion from '.'
import openUrl from '../../util/open-url'

type OwnProps = {assertionKey: string}

const mapStateToProps = (state, ownProps) => {
  const a = state.assertions
    ? state.assertions.get(ownProps.assertionKey, Constants.noAssertion)
    : Constants.noAssertion
  return {
    _metas: a.metas,
    color: a.color,
    proofURL: a.proofURL,
    siteIcon: a.siteIcon,
    siteIconFull: a.siteIconFull,
    siteURL: a.siteURL,
    state: a.state,
    timestamp: a.timestamp,
    type: a.type,
    value: a.value,
  }
}
const mapDispatchToProps = () => ({})

// mapDispatch returns nothing, YET, dispatchProps is referred to??? TODO seems wrong
const mergeProps = (stateProps, dispatchProps, __: OwnProps) => ({
  color: stateProps.color,
  isSuggestion: false,
  isYours: false, // no edit controls on tracker
  metas: stateProps._metas.map(({color, label}) => ({color, label})),
  notAUser: false,
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
  onWhatIsStellar: () => dispatchProps._onWhatIsStellar(),
  proofURL: stateProps.proofURL,
  siteIcon: stateProps.siteIcon,
  siteIconFull: stateProps.siteIconFull,
  siteURL: stateProps.siteURL,
  state: stateProps.state,
  timestamp: stateProps.timestamp,
  type: stateProps.type,
  value: stateProps.value,
})

// Just to get the stories working short term. TODO remove and use newer story wrapper
const ConnectedAssertion = __STORYBOOK__
  ? Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Assertion')(Assertion)
  : Container.remoteConnect(mapStateToProps, mapDispatchToProps, mergeProps)(Assertion as any)
export default ConnectedAssertion
