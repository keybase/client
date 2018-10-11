// @flow
import Available from '.'
import {compose, connect, setDisplayName} from '../../../util/container'

const mapStateToProps = state => ({
  amountErrMsg: state.wallets.builtPayment.amountErrMsg,
})

const mapDispatchToProps = dispatch => ({})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  setDisplayName('Available')
)(Available)
