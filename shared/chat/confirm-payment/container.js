// @flow
import {namedConnect} from '../../util/container'
import PaymentsConfirm from '.'

type OwnProps = {||}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const payments = state.chat2.paymentConfirmInfo?.info?.payments
  return {
    info: {
      displayTotal: state.chat2.paymentConfirmInfo?.info?.displayTotal,
      error: state.chat2.paymentConfirmInfo?.error,
      loading: !state.chat2.paymentConfirmInfo,
      payments: (payments || []).map(p => ({
        displayAmount: p.displayAmount,
        error: p.error,
        fullName: p.fullName,
        username: p.username,
        xlmAmount: p.xlmAmount,
      })),
      xlmTotal: state.chat2.paymentConfirmInfo?.info?.xlmTotal,
    },
    response: state.chat2.paymentConfirmInfo?.response,
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  _onAccept: (response: any) => {
    if (response) {
      response.result(true)
    }
  },
  _onCancel: (response: any) => {
    if (response) {
      response.result(false)
    }
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  ...stateProps.info,
  onAccept: () => dispatchProps._onAccept(stateProps.response),
  onCancel: () => dispatchProps._onCancel(stateProps.response),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PaymentsConfirm'
)(PaymentsConfirm)
