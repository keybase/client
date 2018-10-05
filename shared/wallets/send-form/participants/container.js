// @flow
import * as React from 'react'
import {ParticipantsKeybaseUser, ParticipantsStellarPublicKey, ParticipantsOtherAccount} from '.'
import * as RouteTree from '../../../actions/route-tree'
import * as SearchGen from '../../../actions/search-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as TrackerGen from '../../../actions/tracker-gen'
import {getAccount, getAccounts, searchKey} from '../../../constants/wallets'
import {stringToAccountID, type Account as StateAccount} from '../../../constants/types/wallets'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'

const mapStateToPropsKeybaseUser = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment

  // If build.to is set, assume it's a valid username.
  return {
    recipientUsername: built.toUsername || build.to,
  }
}

const mapDispatchToPropsKeybaseUser = (dispatch: Dispatch) => ({
  onShowProfile: (username: string) => {
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username}))
  },
  onShowSuggestions: () => dispatch(SearchGen.createSearchSuggestions({searchKey})),
  onRemoveProfile: () => dispatch(WalletsGen.createSetBuildingTo({to: ''})),
  onChangeRecipient: (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  },
})

const ConnectedParticipantsKeybaseUser = compose(
  connect(mapStateToPropsKeybaseUser, mapDispatchToPropsKeybaseUser, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('ParticipantsKeybaseUser')
)(ParticipantsKeybaseUser)

const mapStateToPropsStellarPublicKey = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment

  return {
    recipientPublicKey: build.to,
    errorMessage: built.toErrMsg,
  }
}

const mapDispatchToPropsStellarPublicKey = (dispatch: Dispatch) => ({
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
  name: stateAccount.name || stateAccount.accountID,
})

const mapStateToPropsOtherAccount = (state: TypedState) => {
  const build = state.wallets.buildingPayment

  const fromAccount = makeAccount(getAccount(state, stringToAccountID(build.from)))
  const toAccount = build.to ? makeAccount(getAccount(state, stringToAccountID(build.to))) : undefined

  const allAccounts = getAccounts(state)
    .map(makeAccount)
    .toArray()

  return {
    user: state.config.username,
    fromAccount,
    toAccount,
    allAccounts,
  }
}

const mapDispatchToPropsOtherAccount = (dispatch: Dispatch) => ({
  onChangeFromAccount: (from: string) => {
    dispatch(WalletsGen.createSetBuildingFrom({from}))
  },
  onChangeRecipient: (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  },
  onLinkAccount: () =>
    dispatch(
      RouteTree.navigateAppend([
        {
          props: {backButton: true},
          selected: 'linkExisting',
        },
      ])
    ),
  onCreateNewAccount: () =>
    dispatch(
      RouteTree.navigateAppend([
        {
          props: {backButton: true},
          selected: 'createNewAccount',
        },
      ])
    ),
})

const ConnectedParticipantsOtherAccount = compose(
  connect(mapStateToPropsOtherAccount, mapDispatchToPropsOtherAccount, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('ParticipantsOtherAccount')
)(ParticipantsOtherAccount)

const mapStateToPropsChooser = (state: TypedState) => {
  const recipientType = state.wallets.buildingPayment.recipientType
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
