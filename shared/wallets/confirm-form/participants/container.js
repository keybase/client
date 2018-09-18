// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import ConfirmSend, {type ParticipantsProps} from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import {getAccount} from '../../../constants/wallets'

const mapStateToProps = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment

  const recipientType = build.recipientType || 'keybaseUser'
  const recipientUsername = built.toUsername
  const userInfo = state.users.infoMap.get(recipientUsername)
  const recipientFullName = userInfo ? userInfo.fullname : ''
  const fromAccount = getAccount(state, Types.stringToAccountID(built.from))
  const recipientAccount = getAccount(state, Types.stringToAccountID(build.to))
  const recipientStellarAddress = build.to

  return {
    _built: built,
    recipientType,
    yourUsername: state.config.username,
    fromAccountAssets: fromAccount.balanceDescription,
    fromAccountName: fromAccount.name || fromAccount.accountID,
    recipientAccountAssets: recipientAccount.balanceDescription,
    recipientAccountName: recipientAccount.name || recipientAccount.accountID,
    recipientUsername,
    recipientFullName,
    recipientStellarAddress,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _loadAccountDetails: (accountID: Types.AccountID) => dispatch(WalletsGen.createLoadAccount({accountID})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  recipientType: stateProps.recipientType,
  yourUsername: stateProps.yourUsername,
  fromAccountName: stateProps.fromAccountName,
  fromAccountAssets: stateProps.fromAccountAssets,
  loadFromAccountDetails: () =>
    dispatchProps._loadAccountDetails(Types.stringToAccountID(stateProps._built.from)),
  recipientUsername: stateProps.recipientUsername,
  recipientFullName: stateProps.recipientFullName,
  recipientStellarAddress: stateProps.recipientStellarAddress,
  recipientAccountName: stateProps.recipientAccountName,
  recipientAccountAssets: stateProps.recipientAccountAssets,
})

type LoadProps = {|
  loadFromAccountDetails: () => void,
|}
class LoadWrapper extends React.Component<{...ParticipantsProps, ...LoadProps}> {
  componentDidMount() {
    // if (!loaded) { (TODO)
    this.props.loadFromAccountDetails()
    // }
  }

  render() {
    const {loadFromAccountDetails, ...passThroughProps} = this.props
    return <ConfirmSend {...passThroughProps} />
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(LoadWrapper)
