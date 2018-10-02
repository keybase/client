// @flow
import * as React from 'react'
import {ParticipantsKeybaseUser, ParticipantsStellarPublicKey, ParticipantsOtherAccount} from '.'
import * as RouteTree from '../../../actions/route-tree'
import * as SearchGen from '../../../actions/search-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as TrackerGen from '../../../actions/tracker-gen'
import {getAccount, getAccountIDs, searchKey} from '../../../constants/wallets'
import {stringToAccountID} from '../../../constants/types/wallets'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'

const mapStateToPropsKeybaseUser = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment

  return {
    recipientType: 'keybaseUser',
    recipientUsername: built.toUsername || build.to,
  }
}

const mapDispatchToPropsKeybaseUser = (dispatch: Dispatch) => ({
  onChangeRecipient: (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  },
  onShowProfile: (username: string) => {
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username}))
  },
  onShowSuggestions: () => dispatch(SearchGen.createSearchSuggestions({searchKey})),
  onRemoveProfile: () => dispatch(WalletsGen.createSetBuildingTo({to: ''})),
})

const ConnectedParticipantsKeybaseUser = compose(
  connect(mapStateToPropsKeybaseUser, mapDispatchToPropsKeybaseUser, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('ParticipantsKeybaseUser')
)(ParticipantsKeybaseUser)

const mapStateToPropsStellarPublicKey = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment

  return {
    recipientType: 'stellarPublicKey',
    incorrect: built.toErrMsg,
    toFieldInput: build.to,
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

const mapStateToPropsOtherAccount = (state: TypedState) => {
  const build = state.wallets.buildingPayment

  const fromAccountFromState = getAccount(state, stringToAccountID(build.from))
  const fromAccount = {
    contents: fromAccountFromState.balanceDescription,
    id: fromAccountFromState.accountID,
    name: fromAccountFromState.name || fromAccountFromState.accountID,
  }
  let toAccount
  if (build.to) {
    const toAccountFromState = getAccount(state, stringToAccountID(build.to))
    toAccount = {
      contents: toAccountFromState.balanceDescription,
      id: toAccountFromState.accountID,
      name: toAccountFromState.name || toAccountFromState.accountID,
    }
  }

  const allAccounts = getAccountIDs(state)
    .map(accountID => {
      const account = getAccount(state, accountID)
      return {
        contents: account.balanceDescription,
        id: account.accountID,
        name: account.name || account.accountID,
      }
    })
    .toArray()

  return {
    recipientType: 'otherAccount',
    user: state.config.username,
    fromAccount,
    toAccount,
    allAccounts,
  }
}

const mapDispatchToPropsOtherAccount = (dispatch: Dispatch) => ({
  onChangeRecipient: (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  },
  onChangeFromAccount: (from: string) => {
    dispatch(WalletsGen.createSetBuildingFrom({from}))
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
