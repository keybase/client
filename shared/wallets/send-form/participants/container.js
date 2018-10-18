// @flow
import * as React from 'react'
import {ParticipantsKeybaseUser, ParticipantsStellarPublicKey, ParticipantsOtherAccount} from '.'
import * as RouteTree from '../../../actions/route-tree'
import * as SearchGen from '../../../actions/search-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as TrackerGen from '../../../actions/tracker-gen'
import {
  getAccount,
  getAccounts,
  searchKey,
  unknownAccount,
  linkExistingWaitingKey,
  createNewAccountWaitingKey,
} from '../../../constants/wallets'
import {
  stringToAccountID,
  type Account as StateAccount,
  type AccountID,
} from '../../../constants/types/wallets'
import {anyWaiting} from '../../../constants/waiting'
import {compose, connect, setDisplayName} from '../../../util/container'

const mapStateToPropsKeybaseUser = state => {
  const build = state.wallets.building

  // If build.to is set, assume it's a valid username.
  return {
    recipientUsername: build.to,
  }
}

const mapDispatchToPropsKeybaseUser = dispatch => ({
  onChangeRecipient: (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  },
  onRemoveProfile: () => dispatch(WalletsGen.createSetBuildingTo({to: ''})),
  onShowProfile: (username: string) => {
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username}))
  },
  onShowSuggestions: () => dispatch(SearchGen.createSearchSuggestions({searchKey})),
})

const ConnectedParticipantsKeybaseUser = compose(
  connect(mapStateToPropsKeybaseUser, mapDispatchToPropsKeybaseUser, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('ParticipantsKeybaseUser')
)(ParticipantsKeybaseUser)

const mapStateToPropsStellarPublicKey = state => {
  const build = state.wallets.building
  const built = build.isRequest ? state.wallets.builtRequest : state.wallets.builtPayment

  return {
    recipientPublicKey: build.to,
    errorMessage: built.toErrMsg,
  }
}

const mapDispatchToPropsStellarPublicKey = dispatch => ({
  onChangeRecipient: (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  },
})

const ConnectedParticipantsStellarPublicKey = compose(
  connect(mapStateToPropsStellarPublicKey, mapDispatchToPropsStellarPublicKey, (s, d, o) => ({
    ...o,
    ...s,
    ...d,
  })),
  setDisplayName('ParticipantsStellarPublicKey')
)(ParticipantsStellarPublicKey)

const makeAccount = (stateAccount: StateAccount) => ({
  contents: stateAccount.balanceDescription,
  id: stateAccount.accountID,
  isDefault: stateAccount.isDefault,
  name: stateAccount.name,
  unknown: stateAccount === unknownAccount,
})

const mapStateToPropsOtherAccount = state => {
  const build = state.wallets.building

  const fromAccount = makeAccount(getAccount(state, build.from))
  const toAccount = build.to ? makeAccount(getAccount(state, stringToAccountID(build.to))) : undefined
  const showSpinner = toAccount
    ? toAccount.unknown
    : anyWaiting(state, linkExistingWaitingKey, createNewAccountWaitingKey)

  const allAccounts = getAccounts(state)
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
  onChangeFromAccount: (from: AccountID) => {
    dispatch(WalletsGen.createSetBuildingFrom({from}))
  },
  onChangeRecipient: (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  },
  onCreateNewAccount: () =>
    dispatch(
      RouteTree.navigateAppend([
        {
          props: {fromSendRequestForm: true},
          selected: 'createNewAccount',
        },
      ])
    ),
  onLinkAccount: () =>
    dispatch(
      RouteTree.navigateAppend([
        {
          props: {fromSendRequestForm: true},
          selected: 'linkExisting',
        },
      ])
    ),
})

const ConnectedParticipantsOtherAccount = compose(
  connect(mapStateToPropsOtherAccount, mapDispatchToPropsOtherAccount, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('ParticipantsOtherAccount')
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
      /*::
    declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (recipientType: empty) => any
    ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(props.recipientType);
    */
      return null
  }
}

const ConnectedParticipantsChooser = compose(
  connect(mapStateToPropsChooser, () => ({}), (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('Participants')
)(ParticipantsChooser)

export default ConnectedParticipantsChooser
