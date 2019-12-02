import * as React from 'react'
import {ParticipantsKeybaseUser, ParticipantsStellarPublicKey, ParticipantsOtherAccount} from '.'
import * as ProfileGen from '../../../actions/profile-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import {anyWaiting} from '../../../constants/waiting'
import {namedConnect, isMobile} from '../../../util/container'
import {appendWalletPersonBuilder} from '../../../actions/typed-routes'

type OwnProps = {}

const ConnectedParticipantsKeybaseUser = namedConnect(
  state => {
    const build = state.wallets.building
    const built = build.isRequest ? state.wallets.builtRequest : state.wallets.builtPayment

    // If build.to is set, assume it's a valid username.
    return {
      errorMessage: built.toErrMsg,
      isRequest: build.isRequest,
      recipientUsername: build.to,
    }
  },
  dispatch => ({
    onChangeRecipient: (to: string) => {
      dispatch(WalletsGen.createSetBuildingTo({to}))
    },
    onOpenTracker: (username: string) => dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
    onOpenUserProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
    onRemoveProfile: () => dispatch(WalletsGen.createSetBuildingTo({to: ''})),
    onScanQRCode: isMobile ? () => dispatch(RouteTreeGen.createNavigateAppend({path: ['qrScan']})) : null,
    onSearch: () => dispatch(appendWalletPersonBuilder()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const onShowProfile = isMobile ? dispatchProps.onOpenUserProfile : dispatchProps.onOpenTracker
    return {
      ...stateProps,
      onChangeRecipient: dispatchProps.onChangeRecipient,
      onRemoveProfile: dispatchProps.onRemoveProfile,
      onScanQRCode: dispatchProps.onScanQRCode,
      onSearch: dispatchProps.onSearch,
      onShowProfile,
    }
  },
  'ParticipantsKeybaseUser'
)(ParticipantsKeybaseUser)

const ConnectedParticipantsStellarPublicKey = namedConnect(
  state => {
    const build = state.wallets.building
    const built = build.isRequest ? state.wallets.builtRequest : state.wallets.builtPayment

    return {
      errorMessage: built.toErrMsg,
      recipientPublicKey: build.to,
    }
  },
  dispatch => ({
    onChangeRecipient: (to: string) => {
      dispatch(WalletsGen.createSetBuildingTo({to}))
    },
    onScanQRCode: isMobile ? () => dispatch(RouteTreeGen.createNavigateAppend({path: ['qrScan']})) : null,
    setReadyToReview: (readyToReview: boolean) => {
      dispatch(WalletsGen.createSetReadyToReview({readyToReview}))
    },
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'ParticipantsStellarPublicKey'
)(ParticipantsStellarPublicKey)

const makeAccount = (stateAccount: Types.Account) => ({
  contents: stateAccount.balanceDescription,
  id: stateAccount.accountID,
  isDefault: stateAccount.isDefault,
  name: stateAccount.name,
  unknown: stateAccount === Constants.unknownAccount,
})

const ConnectedParticipantsOtherAccount = namedConnect(
  state => {
    const build = state.wallets.building

    const fromAccount = makeAccount(Constants.getAccount(state, build.from))
    const toAccount = build.to
      ? makeAccount(Constants.getAccount(state, Types.stringToAccountID(build.to)))
      : undefined
    const showSpinner = toAccount
      ? toAccount.unknown
      : anyWaiting(state, Constants.linkExistingWaitingKey, Constants.createNewAccountWaitingKey)

    const allAccounts = Constants.getAccounts(state).map(makeAccount)

    return {
      allAccounts,
      fromAccount,
      showSpinner,
      toAccount,
      user: state.config.username,
    }
  },
  dispatch => ({
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
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'ParticipantsOtherAccount'
)(ParticipantsOtherAccount)

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
  state => {
    const recipientType = state.wallets.building.recipientType
    return {recipientType}
  },
  () => ({}),
  (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'Participants'
)(ParticipantsChooser)

export default ConnectedParticipantsChooser
