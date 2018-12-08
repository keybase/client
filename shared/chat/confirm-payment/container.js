// @flow
import {namedConnect} from '../../util/container'
import PaymentsConfirm from '.'

type OwnProps = {||}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const pinfo = state.chat2.paymentConfirmInfo
  const payments = pinfo?.info?.payments
  return {
    info: {
      displayTotal: pinfo?.info?.displayTotal,
      error: pinfo?.error,
      loading: !pinfo,
      payments: (payments || []).map(p => ({
        displayAmount: p.displayAmount,
        error: p.error,
        fullName: p.fullName,
        username: p.username,
        xlmAmount: p.xlmAmount,
      })),
      xlmTotal: pinfo?.info?.xlmTotal,
    },
    response: pinfo?.response,
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
