// @flow
import Participants from '.'
import * as RouteTree from '../../../actions/route-tree'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as TrackerGen from '../../../actions/tracker-gen'
import {getAccount, getAccountIDs} from '../../../constants/wallets'
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
  const fromAccountFromState = getAccount(state, stringToAccountID(build.from))
  const fromAccount = {
    contents: fromAccountFromState.balanceDescription,
    id: fromAccountFromState.accountID,
    name: fromAccountFromState.name || fromAccountFromState.accountID,
  }

  let toAccount
  if (build.to && build.recipientType === 'otherAccount') {
    const toAccountFromState = getAccount(state, stringToAccountID(build.to))
    toAccount = {
      contents: toAccountFromState.balanceDescription,
      id: toAccountFromState.accountID,
      name: toAccountFromState.name || toAccountFromState.accountID,
    }
  }

  // Building section
  const recipientType = build.recipientType || 'keybaseUser'
  // Built section
  const incorrect = built.toErrMsg
  const recipientUsername = built.toUsername

  return {
    allAccounts,
    fromAccount,
    toAccount,
    incorrect,
    recipientType,
    recipientUsername,
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
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('Participants')
)(Participants)
