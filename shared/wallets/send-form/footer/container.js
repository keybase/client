// @flow
import Footer from '.'
import * as Route from '../../../actions/route-tree'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  disabled: !state.wallets.builtPayment.readyToSend,
  worthDescription: state.wallets.builtPayment.worthDescription,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClickSend: () => {
    dispatch(
      Route.navigateAppend([
        {
          props: {},
          selected: 'confirmForm',
        },
      ])
    )
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('Footer')
)(Footer)
