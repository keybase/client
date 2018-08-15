// @flow
import Available from '.'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  amountErrMsg: state.wallets.get('builtPayment').get('amountErrMsg'),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

export default compose(connect(mapStateToProps, mapDispatchToProps), setDisplayName('Available'))(Available)
