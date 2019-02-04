// @flow
import * as Container from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as WalletsType from '../../constants/types/wallets'
import * as Constants from '../../constants/tracker2'
import Assertion from '.'
import openUrl from '../../util/open-url'

type OwnProps = {|
  username: string,
  assertionKey: string,
|}

const mapStateToProps = (state, ownProps) => {
  const d = Constants.getDetails(state, ownProps.username)
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
  _onCopyAddress: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
  _onSendOrRequestLumens: (to: string, isRequest: boolean, recipientType: WalletsType.CounterpartyType) => {
    dispatch(
      WalletsGen.createOpenSendRequestForm({from: WalletsType.noAccountID, isRequest, recipientType, to})
    )
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  color: stateProps.color,
  metas: stateProps._metas.map(({color, label}) => ({color, label})),
  onCopyAddress: () => dispatchProps._onCopyAddress(stateProps.value),
  onRequestLumens: () =>
    dispatchProps._onSendOrRequestLumens(stateProps.value.split('*')[0], true, 'keybaseUser'),
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

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Assertion'
)(Assertion)
