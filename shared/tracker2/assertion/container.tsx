import * as Container from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsType from '../../constants/types/wallets'
import * as Constants from '../../constants/tracker2'
import * as Types from '../../constants/types/tracker2'
import Assertion from '.'
import openUrl from '../../util/open-url'

type OwnProps = {
  isSuggestion?: boolean
  username: string
  assertionKey: string
}

const notAUserAssertion = {
  color: 'gray',
  metas: [
    {
      color: 'gray',
      label: 'PENDING',
    },
  ],
  proofURL: '',
  sigID: '0',
  siteIcon: null,
  siteIconFull: null,
  siteURL: '',
  state: 'checking',
  timestamp: 0,
}

const mapStateToProps = (state, ownProps) => {
  let a = Constants.noAssertion
  let notAUser = false
  if (ownProps.isSuggestion) {
    a =
      state.tracker2.proofSuggestions.find(s => s.assertionKey === ownProps.assertionKey) ||
      Constants.noAssertion
  } else {
    const d = Constants.getDetails(state, ownProps.username)
    notAUser = d.state === 'notAUserYet'
    if (notAUser) {
      const nonUserDetails = Constants.getNonUserDetails(state, ownProps.username)
      // @ts-ignore codemod issue
      a = {
        ...notAUserAssertion,
        siteIcon: nonUserDetails.siteIcon,
        siteIconFull: nonUserDetails.siteIconFull,
        siteURL: nonUserDetails.siteURL,
        type: nonUserDetails.assertionKey,
        value: nonUserDetails.assertionValue,
      }
    } else if (d.assertions) {
      a = d.assertions.get(ownProps.assertionKey, Constants.noAssertion)
    }
  }
  return {
    _metas: a.metas,
    _sigID: a.sigID,
    color: a.color,
    isYours: ownProps.username === state.config.username,
    notAUser,
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
const mapDispatchToProps = dispatch => ({
  _onCopyAddress: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
  _onCreateProof: (type: string) => dispatch(ProfileGen.createAddProof({platform: type, reason: 'profile'})),
  _onRecheck: (sigID: string) => dispatch(ProfileGen.createRecheckProof({sigID})),
  _onRevokeProof: (type: string, value: string, id: string, icon: Types.SiteIconSet) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {icon, platform: type, platformHandle: value, proofId: id},
            selected: 'profileRevoke',
          },
        ],
      })
    ),

  _onSendOrRequestLumens: (to: string, isRequest: boolean, recipientType: WalletsType.CounterpartyType) => {
    dispatch(
      WalletsGen.createOpenSendRequestForm({from: WalletsType.noAccountID, isRequest, recipientType, to})
    )
  },
  _onWhatIsStellar: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['whatIsStellarModal']})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  return {
    color: stateProps.color,
    isSuggestion: !!ownProps.isSuggestion,
    isYours: stateProps.isYours,
    metas: stateProps._metas.map(({color, label}) => ({color, label})),
    notAUser: stateProps.notAUser,
    onCopyAddress: () => dispatchProps._onCopyAddress(stateProps.value),
    onCreateProof: stateProps.notAUser
      ? undefined
      : ownProps.isSuggestion
      ? () => dispatchProps._onCreateProof(stateProps.type)
      : undefined,
    onRecheck: () => dispatchProps._onRecheck(stateProps._sigID),
    onRequestLumens: () =>
      dispatchProps._onSendOrRequestLumens(stateProps.value.split('*')[0], true, 'keybaseUser'),
    onRevoke: () => {
      if (stateProps.siteIconFull)
        dispatchProps._onRevokeProof(
          stateProps.type,
          stateProps.value,
          stateProps._sigID,
          stateProps.siteIconFull
        )
    },
    onSendLumens: () =>
      dispatchProps._onSendOrRequestLumens(stateProps.value.split('*')[0], false, 'keybaseUser'),
    onShowProof: stateProps.notAUser || !stateProps.proofURL ? undefined : () => openUrl(stateProps.proofURL),
    onShowSite: stateProps.notAUser || !stateProps.siteURL ? undefined : () => openUrl(stateProps.siteURL),
    onWhatIsStellar: () => dispatchProps._onWhatIsStellar(),
    proofURL: stateProps.proofURL,
    siteIcon: stateProps.siteIcon,
    siteIconFull: stateProps.siteIconFull,
    siteURL: stateProps.siteURL,
    state: stateProps.state,
    timestamp: stateProps.timestamp,
    type: stateProps.type,
    value: stateProps.value,
  }
}

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Assertion')(
  Assertion
) as any
