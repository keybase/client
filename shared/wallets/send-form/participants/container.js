// @flow
import Participants, {type Account} from '.'
import * as RouteTree from '../../../actions/route-tree'
import * as SearchGen from '../../../actions/search-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as TrackerGen from '../../../actions/tracker-gen'
import {getAccount, getAccountIDs, searchKey} from '../../../constants/wallets'
import {stringToAccountID} from '../../../constants/types/wallets'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'

type StateProps =
  | {|
      recipientType: 'keybaseUser',
      recipientUsername: string,
    |}
  | {|
      recipientType: 'stellarPublicKey',
      incorrect?: string,
      toFieldInput: string,
    |}
  | {|
      recipientType: 'otherAccount',
      user: string,
      fromAccount?: Account,
      toAccount?: Account,
      allAccounts: Account[],
    |}

const mapStateToProps = (state: TypedState): StateProps => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment

  switch (build.recipientType) {
    case 'keybaseUser':
      return {
        recipientType: 'keybaseUser',
        recipientUsername: built.toUsername || build.to,
      }
    case 'stellarPublicKey':
      return {
        recipientType: 'stellarPublicKey',
        incorrect: built.toErrMsg,
        toFieldInput: build.to,
      }

    case 'otherAccount':
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

    default:
      /*::
    declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (recipientType: empty) => any
    ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(build.recipientType);
    */
      throw new Error('unreachable')
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onChangeFromAccount: (from: string) => {
    dispatch(WalletsGen.createSetBuildingFrom({from}))
  },
  onChangeRecipient: (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  },
  onCreateNewAccount: () =>
    dispatch(
      RouteTree.navigateAppend([
        {
          props: {backButton: true},
          selected: 'createNewAccount',
        },
      ])
    ),
  onLinkAccount: () =>
    dispatch(
      RouteTree.navigateAppend([
        {
          props: {backButton: true},
          selected: 'linkExisting',
        },
      ])
    ),
  onRemoveProfile: () => dispatch(WalletsGen.createSetBuildingTo({to: ''})),
  onShowProfile: (username: string) => {
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username}))
  },
  onShowSuggestions: () => dispatch(SearchGen.createSearchSuggestions({searchKey})),
})

const mergeProps = (stateProps: StateProps, dispatchProps) => {
  switch (stateProps.recipientType) {
    case 'keybaseUser':
      return {
        recipientType: 'keybaseUser',
        recipientUsername: stateProps.recipientUsername,
        onChangeRecipient: dispatchProps.onChangeRecipient,
        onShowProfile: dispatchProps.onShowProfile,
        onShowSuggestions: dispatchProps.onShowSuggestions,
        onRemoveProfile: dispatchProps.onRemoveProfile,
      }
    case 'stellarPublicKey':
      return {
        recipientType: stateProps.recipientType,
        incorrect: stateProps.incorrect,
        toFieldInput: stateProps.toFieldInput,
        onChangeRecipient: dispatchProps.onChangeRecipient,
      }

    case 'otherAccount':
      return {
        recipientType: 'otherAccount',
        user: stateProps.user,
        fromAccount: stateProps.fromAccount,
        toAccount: stateProps.toAccount,
        allAccounts: stateProps.allAccounts,
        onChangeFromAccount: dispatchProps.onChangeFromAccount,
        onChangeRecipient: dispatchProps.onChangeRecipient,
        onLinkAccount: dispatchProps.onLinkAccount,
        onCreateNewAccount: dispatchProps.onCreateNewAccount,
      }

    default:
      /*::
    declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (recipientType: empty) => any
    ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(stateProps.recipientType);
    */
      throw new Error('unreachable')
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('Participants')
)(Participants)
