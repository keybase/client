// @flow
import * as Container from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsType from '../../constants/types/wallets'
import * as Constants from '../../constants/tracker2'
import Assertion from '.'
import openUrl from '../../util/open-url'

type OwnProps = {|
  isSuggestion?: boolean,
  username: string,
  assertionKey: string,
|}

const mapStateToProps = (state, ownProps) => {
  let a = Constants.noAssertion
  if (ownProps.isSuggestion) {
    a =
      state.tracker2.proofSuggestions.find(s => s.assertionKey === ownProps.assertionKey) ||
      Constants.noAssertion
  } else {
    const d = Constants.getDetails(state, ownProps.username)
    if (d.assertions) {
      a = d.assertions.get(ownProps.assertionKey, Constants.noAssertion)
    }
  }
  return {
    _metas: a.metas,
    _sigID: a.sigID,
    color: a.color,
    isYours: ownProps.username === state.config.username,
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
  // $FlowIssue we need to make this more flexible later
  _onCreateProof: (type: string) => dispatch(ProfileGen.createAddProof({platform: type})),
  _onRecheck: (sigID: string) => dispatch(ProfileGen.createRecheckProof({sigID})),
  _onRevokeProof: (type: string, value: string, id: string) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {platform: type, platformHandle: value, proofId: id},
            selected: 'revoke',
          },
        ],
      })
    ),

  _onSendOrRequestLumens: (to: string, isRequest: boolean, recipientType: WalletsType.CounterpartyType) => {
    dispatch(
      WalletsGen.createOpenSendRequestForm({from: WalletsType.noAccountID, isRequest, recipientType, to})
    )
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  color: stateProps.color,
  isSuggestion: !!ownProps.isSuggestion,
  isYours: stateProps.isYours,
  metas: stateProps._metas.map(({color, label}) => ({color, label})),
  onCopyAddress: () => dispatchProps._onCopyAddress(stateProps.value),
  onCreateProof: ownProps.isSuggestion ? () => dispatchProps._onCreateProof(stateProps.type) : undefined,
  onRecheck: () => dispatchProps._onRecheck(stateProps._sigID),
  onRequestLumens: () =>
    dispatchProps._onSendOrRequestLumens(stateProps.value.split('*')[0], true, 'keybaseUser'),
  onRevoke: () => dispatchProps._onRevokeProof(stateProps.type, stateProps.value, stateProps._sigID),
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
