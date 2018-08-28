// @flow
import ConfirmSend from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'

const mapStateToProps = (state: TypedState) => {
  const build = state.wallets.buildingPayment
  const built = state.wallets.builtPayment

  const recipientType = build.recipientType || 'keybaseUser'
  const to = build.to
  const recipientStellarAddress = recipientType === 'stellarPublicKey' ? to : undefined

  return {
    recipientType,
    yourUsername: state.config.username,
    // TODO - Integration PR - fill these in
    fromAccountName: '',
    fromAccountContents: '',
    recipientUsername: built.toUsername,
    recipientFullName: 'placeholder', // TODO: get a way to get full names from usernames
    recipientStellarAddress,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => {}

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))(ConfirmSend)
