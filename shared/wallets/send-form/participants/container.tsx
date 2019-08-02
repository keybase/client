import * as React from 'react'
import {ParticipantsKeybaseUser, ParticipantsStellarPublicKey, ParticipantsOtherAccount} from '.'
import * as ProfileGen from '../../../actions/profile-gen'
import * as SearchGen from '../../../actions/search-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import {anyWaiting} from '../../../constants/waiting'
import {namedConnect, isMobile} from '../../../util/container'

type OwnProps = {}

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
  onOpenTracker: (username: string) => dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
  onOpenUserProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  onRemoveProfile: () => dispatch(WalletsGen.createSetBuildingTo({to: ''})),
  onScanQRCode: isMobile ? () => dispatch(RouteTreeGen.createNavigateAppend({path: ['qrScan']})) : null,
  onShowSuggestions: () => dispatch(SearchGen.createSearchSuggestions({searchKey: Constants.searchKey})),
})

const mergePropsKeybaseUser = (stateProps, dispatchProps, _: OwnProps) => {
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

const ConnectedParticipantsKeybaseUser = namedConnect(
  mapStateToPropsKeybaseUser,
  mapDispatchToPropsKeybaseUser,
  mergePropsKeybaseUser,
  'ParticipantsKeybaseUser'
)(ParticipantsKeybaseUser)

const mapStateToPropsStellarPublicKey = state => {
  const build = state.wallets.building
  const built = build.isRequest ? state.wallets.builtRequest : state.wallets.builtPayment

  return {
    errorMessage: built.toErrMsg,
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

const ConnectedParticipantsStellarPublicKey = namedConnect(
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
        path: [{props: {fromSendForm: true}, selected: 'createNewAccount'}],
      })
    ),
  onLinkAccount: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {fromSendForm: true}, selected: 'linkExisting'}],
      })
    ),
})

const ConnectedParticipantsOtherAccount = namedConnect(
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
      // @ts-ignore not sure what's up here
      return <ConnectedParticipantsKeybaseUser />
    case 'stellarPublicKey':
      // @ts-ignore not sure what's up here
      return <ConnectedParticipantsStellarPublicKey />
    case 'otherAccount':
      // @ts-ignore not sure what's up here
      return <ConnectedParticipantsOtherAccount />

    default:
      throw new Error(`Unexpected recipientType ${props.recipientType}`)
  }
}

const ConnectedParticipantsChooser = namedConnect(
  mapStateToPropsChooser,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d}),
  'Participants'
)(ParticipantsChooser)

export default ConnectedParticipantsChooser
