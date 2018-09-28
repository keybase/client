// @flow
import Participants from '.'
import * as SearchGen from '../../../actions/search-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as TrackerGen from '../../../actions/tracker-gen'
import {getAccount, getAccountIDs, searchKey} from '../../../constants/wallets'
import {stringToAccountID} from '../../../constants/types/wallets'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'

const mapStateToProps = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment

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
  let fromAccount
  let toAccount
  if (build.recipientType === 'otherAccount') {
    const fromAccountFromState = getAccount(state, stringToAccountID(build.from))
    fromAccount = {
      contents: fromAccountFromState.balanceDescription,
      id: fromAccountFromState.accountID,
      name: fromAccountFromState.name || fromAccountFromState.accountID,
    }
    if (build.to) {
      const toAccountFromState = getAccount(state, stringToAccountID(build.to))
      toAccount = {
        contents: toAccountFromState.balanceDescription,
        id: toAccountFromState.accountID,
        name: toAccountFromState.name || toAccountFromState.accountID,
      }
    }
  }

  // Building section
  const recipientType = build.recipientType || 'keybaseUser'
  const toFieldInput = build.to
  // Built section
  const incorrect = built.toErrMsg
  const recipientUsername = built.toUsername

  return {
    allAccounts,
    fromAccount,
    incorrect,
    recipientType,
    recipientUsername,
    toAccount,
    toFieldInput,
    user: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onChangeFromAccount: (from: string) => {
    dispatch(WalletsGen.createSetBuildingFrom({from}))
  },
  onChangeRecipient: (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  },
  onRemoveProfile: () => dispatch(WalletsGen.createSetBuildingTo({to: ''})),
  onShowProfile: (username: string) => {
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username}))
  },
  onShowSuggestions: () => dispatch(SearchGen.createSearchSuggestions({searchKey})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('Participants')
)(Participants)
