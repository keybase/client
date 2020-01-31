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
  assertionKey: '',
  belowFold: false,
  color: 'gray' as const,
  kid: '',
  metas: [{color: 'gray' as const, label: 'PENDING'}],
  pickerSubtext: '',
  pickerText: '',
  priority: 0,
  proofURL: '',
  sigID: '0',
  siteIcon: null,
  siteIconDarkmode: null,
  siteIconFull: null,
  siteIconFullDarkmode: null,
  siteURL: '',
  state: 'checking' as const,
  timestamp: 0,
}

export default Container.namedConnect(
  (state, ownProps: OwnProps) => {
    let a = Constants.noAssertion
    let notAUser = false
    let stellarHidden = false
    const isYours = ownProps.username === state.config.username
    if (ownProps.isSuggestion) {
      a =
        state.tracker2.proofSuggestions.find(s => s.assertionKey === ownProps.assertionKey) ||
        Constants.noAssertion
    } else {
      const d = Constants.getDetails(state, ownProps.username)
      if (isYours && d.stellarHidden) {
        stellarHidden = true
      }
      notAUser = d.state === 'notAUserYet'
      if (notAUser) {
        const nonUserDetails = Constants.getNonUserDetails(state, ownProps.username)
        a = {
          ...notAUserAssertion,
          siteIcon: nonUserDetails.siteIcon,
          siteIconDarkmode: nonUserDetails.siteIconDarkmode,
          siteIconFull: nonUserDetails.siteIconFull,
          siteIconFullDarkmode: nonUserDetails.siteIconFullDarkmode,
          siteURL: nonUserDetails.siteURL,
          type: nonUserDetails.assertionKey,
          value: nonUserDetails.assertionValue,
        }
      } else if (d.assertions) {
        a = d.assertions.get(ownProps.assertionKey) || Constants.noAssertion
      }
    }
    return {
      _metas: a.metas,
      _sigID: a.sigID,
      color: a.color,
      isYours,
      notAUser,
      proofURL: a.proofURL,
      siteIcon: a.siteIcon,
      siteIconDarkmode: a.siteIconDarkmode,
      siteIconFull: a.siteIconFull,
      siteIconFullDarkmode: a.siteIconFullDarkmode,
      siteURL: a.siteURL,
      state: a.state,
      stellarHidden,
      timestamp: a.timestamp,
      type: a.type,
      value: a.value,
    }
  },
  dispatch => ({
    _onCopyAddress: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    _onCreateProof: (type: string) =>
      dispatch(ProfileGen.createAddProof({platform: type, reason: 'profile'})),
    _onHideStellar: (hidden: boolean) => dispatch(ProfileGen.createHideStellar({hidden})),
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
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
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
      onHideStellar: (hidden: boolean) => dispatchProps._onHideStellar(hidden),
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
      onShowProof:
        stateProps.notAUser || !stateProps.proofURL ? undefined : () => openUrl(stateProps.proofURL),
      onShowSite: stateProps.notAUser || !stateProps.siteURL ? undefined : () => openUrl(stateProps.siteURL),
      onWhatIsStellar: () => dispatchProps._onWhatIsStellar(),
      proofURL: stateProps.proofURL,
      siteIcon: stateProps.siteIcon,
      siteIconDarkmode: stateProps.siteIconDarkmode,
      siteIconFull: stateProps.siteIconFull,
      siteIconFullDarkmode: stateProps.siteIconFullDarkmode,
      siteURL: stateProps.siteURL,
      state: stateProps.state,
      stellarHidden: stateProps.stellarHidden,
      timestamp: stateProps.timestamp,
      type: stateProps.type,
      value: stateProps.value,
    }
  },
  'Assertion'
)(Assertion)
