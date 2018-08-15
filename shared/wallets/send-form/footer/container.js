// @flow
import Footer from '.'
import * as Route from '../../../actions/route-tree'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  disabled: !state.wallets.get('builtPayment').get('readyToSend'),
  worthDescription: state.wallets.get('builtPayment').get('worthDescription'),
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

export default compose(connect(mapStateToProps, mapDispatchToProps), setDisplayName('Footer'))(Footer)
