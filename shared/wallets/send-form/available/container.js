// @flow
import Available from '.'
import {compose, connect, setDisplayName, type TypedState} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  amountErrMsg: state.wallets.builtPayment.amountErrMsg,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('Available')
)(Available)
