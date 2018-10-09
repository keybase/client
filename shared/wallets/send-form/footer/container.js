// @flow
import Footer from '.'
import * as Route from '../../../actions/route-tree'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Constants from '../../../constants/wallets'
import {compose, connect, setDisplayName} from '../../../util/container'

const mapStateToProps = state => ({
  isRequest: state.wallets.buildingPayment.isRequest,
  disabled: !state.wallets.builtPayment.readyToSend,
  worthDescription: state.wallets.builtPayment.worthDescription,
})

const mapDispatchToProps = dispatch => ({
  onClickRequest: () => {
    dispatch(WalletsGen.createRequestPayment())
  },
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

const mergeProps = (s, d, o) => ({
  disabled: s.disabled,
  worthDescription: s.worthDescription,
  onClickRequest: s.isRequest ? d.onClickRequest : undefined,
  onClickSend: s.isRequest ? undefined : d.onClickSend,
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('Footer')
)(Footer)
