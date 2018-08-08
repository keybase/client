// @flow
import Body from '.'
import {compose, connect, setDisplayName, type TypedState, type Dispatch, withStateHandlers, withHandlers} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBuild: ({address, amount}) => {
    console.warn('in onBuild', address, amount)
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
    onClickSend: ({address, amount, onBuild}) => () => onBuild({address, amount}),
  }),
)(Body)
