// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Bootstrapable from '../../util/bootstrapable'
import HiddenString from '../../util/hidden-string'

import * as actions from '../../actions/plan-billing'
import Payment from './index'
import {parseExpiration} from '../../constants/plan-billing'

import type {TypedState} from '../../constants/reducer'

type OwnProps = {}

type State = {
  cardNumber: ?string,
  name: ?string,
  expiration: ?string,
  securityCode: ?string,
}

type Props = {
  errorMessage?: ?string,
  clearBillingError: () => void,
  onBack: () => void,
  onSubmit: (cardNumber: ?string, name: ?string, securityCode: ?string, expiration: ?string) => void,
}

class PaymentStateHolder extends Component<void, Props, State> {
  state: State
  constructor() {
    super()
    this.state = {
      cardNumber: null,
      name: null,
      expiration: null,
      securityCode: null,
    }
  }

  _clearErrorAndSetState(nextState) {
    this.props.errorMessage && this.props.clearBillingError()
    this.setState(nextState)
  }

  render() {
    return (
      <Payment
        onChangeCardNumber={cardNumber => this._clearErrorAndSetState({cardNumber})}
        onChangeName={name => this._clearErrorAndSetState({name})}
        onChangeExpiration={expiration => this._clearErrorAndSetState({expiration})}
        onChangeSecurityCode={securityCode => this._clearErrorAndSetState({securityCode})}
        cardNumber={this.state.cardNumber}
        name={this.state.name}
        expiration={this.state.expiration}
        securityCode={this.state.securityCode}
        errorMessage={this.props.errorMessage}
        onBack={this.props.onBack}
        onSubmit={() =>
          this.props.onSubmit(
            this.state.cardNumber,
            this.state.name,
            this.state.securityCode,
            this.state.expiration
          )}
      />
    )
  }
}

export default connect(
  (state: TypedState, ownProps: OwnProps) => {
    const {planBilling: {plan, errorMessage}} = state
    if (!plan) {
      return {
        bootstrapDone: false,
      }
    }

    return {
      bootstrapDone: true,
      originalProps: {
        errorMessage: errorMessage,
        onBack: () => console.log('todo'),
      },
    }
  },
  (dispatch: (a: any) => void, ownProps: OwnProps) => ({
    onBootstrap: () => {
      dispatch(actions.bootstrapData())
    },
    onSubmit: args => {
      dispatch(actions.updateBilling(args))
    },
    clearBillingError: () => {
      dispatch(actions.clearBillingError())
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    if (stateProps.bootstrapDone === false) {
      return {
        bootstrapDone: false,
        onBootstrap: dispatchProps.onBootstrap,
      }
    }

    return {
      bootstrapDone: true,
      originalProps: {
        ...stateProps.originalProps,
        onSubmit: (cardNumber: ?string, name: ?string, securityCode: ?string, expiration: ?string) => {
          const parsedExpiration = parseExpiration(expiration || '')
          dispatchProps.onSubmit({
            cardNumber: new HiddenString(cardNumber || ''),
            nameOnCard: new HiddenString(name || ''),
            securityCode: new HiddenString(securityCode || ''),
            cardExpMonth: new HiddenString(parsedExpiration.month),
            cardExpYear: new HiddenString(parsedExpiration.year),
          })
        },
        clearBillingError: dispatchProps.clearBillingError,
      },
    }
  }
)(Bootstrapable(PaymentStateHolder))
