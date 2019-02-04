// @flow
import * as React from 'react'
import {ParticipantsKeybaseUser, ParticipantsStellarPublicKey, ParticipantsOtherAccount} from '.'
import * as ProfileGen from '../../../actions/profile-gen'
import * as Flow from '../../../util/flow'
import * as SearchGen from '../../../actions/search-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as TrackerGen from '../../../actions/tracker-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as RouteTree from '../../../route-tree'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import {anyWaiting} from '../../../constants/waiting'
import {namedConnect, isMobile} from '../../../util/container'

type OwnProps = {||}

const mapStateToPropsKeybaseUser = state => {
  const build = state.wallets.building
  const built = build.isRequest ? state.wallets.builtRequest : state.wallets.builtPayment

  // If build.to is set, assume it's a valid username.
  return {
    errorMessage: built.toErrMsg,
    isRequest: build.isRequest,
    recipientUsername: build.to,
  }
}

const mapDispatchToPropsKeybaseUser = dispatch => ({
  onChangeRecipient: (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  },
  onOpenTracker: (username: string) =>
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
  onOpenUserProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  onRemoveProfile: () => dispatch(WalletsGen.createSetBuildingTo({to: ''})),
  onScanQRCode: isMobile ? () => dispatch(RouteTreeGen.createNavigateAppend({path: ['qrScan']})) : null,
  onShowSuggestions: () => dispatch(SearchGen.createSearchSuggestions({searchKey: Constants.searchKey})),
})

const mergePropsKeybaseUser = (stateProps, dispatchProps) => {
  const onShowProfile = isMobile ? dispatchProps.onOpenUserProfile : dispatchProps.onOpenTracker
  return {
    ...stateProps,
    onChangeRecipient: dispatchProps.onChangeRecipient,
    onRemoveProfile: dispatchProps.onRemoveProfile,
    onScanQRCode: dispatchProps.onScanQRCode,
    onShowProfile,
    onShowSuggestions: dispatchProps.onShowSuggestions,
  }
}

const ConnectedParticipantsKeybaseUser = namedConnect<OwnProps, _, _, _, _>(
  mapStateToPropsKeybaseUser,
  mapDispatchToPropsKeybaseUser,
  mergePropsKeybaseUser,
  'ParticipantsKeybaseUser'
)(ParticipantsKeybaseUser)

// This thing has internal state to handle typing, but under some circumstances we want it to blow away all that data
// and just take in the props again (aka remount) so, in order to achieve this in the least invasive way we'll watch the
// route and we'll increment out key if we become topmost again
let keyCounter = 1
let lastPath = ''

const mapStateToPropsStellarPublicKey = state => {
  const build = state.wallets.building
  const built = build.isRequest ? state.wallets.builtRequest : state.wallets.builtPayment

  const curPath = RouteTree.getPath(state.routeTree.routeState, [Constants.rootWalletTab]).last()
  // looking at the form now, but wasn't before
  if (curPath === Constants.sendRequestFormRouteKey && curPath !== lastPath) {
    keyCounter++
  }

  lastPath = curPath

  return {
    errorMessage: built.toErrMsg,
    keyCounter,
    recipientPublicKey: build.to,
  }
}

const mapDispatchToPropsStellarPublicKey = dispatch => ({
  onChangeRecipient: (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  },
  onScanQRCode: isMobile ? () => dispatch(RouteTreeGen.createNavigateAppend({path: ['qrScan']})) : null,
  setReadyToReview: (readyToReview: boolean) => {
    dispatch(WalletsGen.createSetReadyToReview({readyToReview}))
  },
})

const ConnectedParticipantsStellarPublicKey = namedConnect<OwnProps, _, _, _, _>(
  mapStateToPropsStellarPublicKey,
  mapDispatchToPropsStellarPublicKey,
  (s, d, o) => ({...o, ...s, ...d}),
  'ParticipantsStellarPublicKey'
)(ParticipantsStellarPublicKey)

const makeAccount = (stateAccount: Types.Account) => ({
  contents: stateAccount.balanceDescription,
  id: stateAccount.accountID,
  isDefault: stateAccount.isDefault,
  name: stateAccount.name,
  unknown: stateAccount === Constants.unknownAccount,
})

const mapStateToPropsOtherAccount = state => {
  const build = state.wallets.building

  const fromAccount = makeAccount(Constants.getAccount(state, build.from))
  const toAccount = build.to
    ? makeAccount(Constants.getAccount(state, Types.stringToAccountID(build.to)))
    : undefined
  const showSpinner = toAccount
    ? toAccount.unknown
    : anyWaiting(state, Constants.linkExistingWaitingKey, Constants.createNewAccountWaitingKey)

  const allAccounts = Constants.getAccounts(state)
    .map(makeAccount)
    .toArray()

  return {
    allAccounts,
    fromAccount,
    showSpinner,
    toAccount,
    user: state.config.username,
  }
}

const mapDispatchToPropsOtherAccount = dispatch => ({
  onChangeFromAccount: (from: Types.AccountID) => {
    dispatch(WalletsGen.createSetBuildingFrom({from}))
  },
  onChangeRecipient: (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  },
  onCreateNewAccount: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {backButton: true, fromSendForm: true}, selected: 'createNewAccount'}],
      })
    ),
  onLinkAccount: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {backButton: true, fromSendForm: true}, selected: 'linkExisting'}],
      })
    ),
})

const ConnectedParticipantsOtherAccount = namedConnect<OwnProps, _, _, _, _>(
  mapStateToPropsOtherAccount,
  mapDispatchToPropsOtherAccount,
  (s, d, o) => ({...o, ...s, ...d}),
  'ParticipantsOtherAccount'
)(ParticipantsOtherAccount)

const mapStateToPropsChooser = state => {
  const recipientType = state.wallets.building.recipientType
  return {recipientType}
}

const ParticipantsChooser = props => {
  switch (props.recipientType) {
    case 'keybaseUser':
      return <ConnectedParticipantsKeybaseUser />
    case 'stellarPublicKey':
      return <ConnectedParticipantsStellarPublicKey />

    case 'otherAccount':
      return <ConnectedParticipantsOtherAccount />

    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.recipientType)
      throw new Error(`Unexpected recipientType ${props.recipientType}`)
  }
}

const ConnectedParticipantsChooser = namedConnect<OwnProps, _, _, _, _>(
  mapStateToPropsChooser,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d}),
  'Participants'
)(ParticipantsChooser)

export default ConnectedParticipantsChooser
