// @flow
import Body from '.'
import {compose, connect, setDisplayName, type TypedState, type Dispatch, withStateHandlers, withHandlers} from '../../../util/container'
import * as WalletsGen from '../../../actions/wallets-gen'
import {navigateUp} from '../../../actions/route-tree'
const mapStateToProps = (state: TypedState) => {

  const build = state.wallets.sendFormMap.get(state.wallets.selectedAccount)
  const readyToSend = build && build.get('readyToSend')
  const toErrMsg = build && build.get('toErrMsg')
  const username = build && build.get('toUsername')
  const warningAsset = build && build.get('amountErrMsg')
  const worthDescription = build && build.get('worthDescription')
  console.warn('in body mstp', build, warningAsset, worthDescription)
  return {
    readyToSend,
    toErrMsg,
    username,
    warningAsset,
    worthDescription,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onBuild: ({address, amount, from}) => {
    console.warn('in onBuild', address, amount, from)
    dispatch(WalletsGen.createBuildPayment({amount, from, to: address}))
  },
  _onConfirm: ({address, amount, from}) => {
    dispatch(WalletsGen.createSendPayment({amount, from, to: address}))
    dispatch(navigateUp())

  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  setDisplayName('Body'),
  withStateHandlers(
    {address: '', amount: 0},
    {
      onChangeAddress: () => address => { console.warn('in onChangeAddress', address);  return ({address}) },
      onChangeAmount: () => amount => { console.warn('in onChangeAmount', amount); return ({amount}) },
    },
  ),
  withHandlers({
    onBuild: ({_onBuild, address, amount, from}) => () => _onBuild({address, amount, from}),
  }),
  withHandlers({
    onClickSend: ({address, amount, onBuild}) => () => onBuild({address, amount}),
    onConfirmSend: ({_onConfirm, address, amount, onConfirm}) => () => _onConfirm({address, amount})
  }),
)(Body)
