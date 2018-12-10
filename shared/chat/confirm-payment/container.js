// @flow
import * as Chat2Gen from '../../actions/chat2-gen'
import {namedConnect} from '../../util/container'
import PaymentsConfirm from '.'

type OwnProps = {||}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const pinfo = state.chat2.paymentConfirmInfo
  const payments = pinfo?.summary?.payments || []
  return {
    displayTotal: pinfo?.summary?.displayTotal,
    error: pinfo?.error,
    loading: !pinfo,
    payments: payments.map(p => ({
      displayAmount: p.displayAmount,
      error: p.error,
      fullName: p.fullName,
      username: p.username,
      xlmAmount: p.xlmAmount,
    })),
    xlmTotal: pinfo?.summary?.xlmTotal,
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onAccept: () => {
    dispatch(Chat2Gen.createConfirmScreenResponse({accept: true}))
  },
  onCancel: () => {
    dispatch(Chat2Gen.createConfirmScreenResponse({accept: false}))
  },
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'PaymentsConfirm'
)(PaymentsConfirm)
