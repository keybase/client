// @flow
import Footer from '.'
import * as Route from '../../../actions/route-tree'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Constants from '../../../constants/wallets'
import {compose, connect, setDisplayName, type TypedState} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  disabled: !state.wallets.builtPayment.readyToSend,
  worthDescription: state.wallets.builtPayment.worthDescription,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps) => ({
  onClickRequest:
    ownProps.isRequest &&
    (() => {
      dispatch(WalletsGen.createRequestPayment())
    }),
  onClickSend: () => {
    dispatch(
      Route.navigateAppend([
        {
          props: {},
          selected: Constants.confirmFormRouteKey,
        },
      ])
    )
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('Footer')
)(Footer)
