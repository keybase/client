// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {namedConnect} from '../../util/container'

import PaymentsConfirm from '.'

type OwnProps = {||}

const mapStateToProps = (state, ownProps: OwnProps) => {
  if (!state.chat2.paymentConfirmInfo) {
    return {
      info: {
        displayTotal: '',
        loading: true,
        payments: [],
        xlmTotal: '',
      },
      response: null,
    }
  } else {
    const {info, response} = state.chat2.paymentConfirmInfo
    return {
      info: {
        displayTotal: info.displayTotal,
        loading: false,
        payments: (info.payments || []).map(p => ({
          username: p.username,
          fullName: p.fullName,
          xlmAmount: p.xlmAmount,
          error: p.error,
          displayAmount: p.displayAmount,
        })),
        xlmTotal: info.xlmTotal,
      },
      response,
    }
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
