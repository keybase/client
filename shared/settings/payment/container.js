// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Bootstrapable from '../../util/bootstrapable'
import HiddenString from '../../util/hidden-string'

import * as actions from '../../actions/plan-billing'
import Payment from './index'
import {parseExpiration} from '../../constants/plan-billing'

import type {UpdateBillingArgs} from '../../constants/plan-billing'
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
  parseExpiration: (expiration: string) => {month: string, year: string, error?: string}, // parsed 01/18 to [01, 18] and the like...
  onSubmit: (args: UpdateBillingArgs) => void,
}

class PaymentStateHolder extends Component<void, Props, State> {
  state: State;

  constructor () {
    super()
    this.state = {
      cardNumber: null,
      name: null,
      expiration: null,
      securityCode: null,
    }
  }

  _clearErrorAndSetState (nextState) {
    this.props.errorMessage && this.props.clearBillingError()
    this.setState(nextState)
  }

  render () {
    const parsedExpiration = this.props.parseExpiration(this.state.expiration || '')
    return (
      <Payment
        onChangeCardNumber={(cardNumber) => this._clearErrorAndSetState({cardNumber})}
        onChangeName={(name) => this._clearErrorAndSetState({name})}
        onChangeExpiration={(expiration) => this._clearErrorAndSetState({expiration})}
        onChangeSecurityCode={(securityCode) => this._clearErrorAndSetState({securityCode})}
        cardNumber={this.state.cardNumber}
        name={this.state.name}
        expiration={this.state.expiration}
        securityCode={this.state.securityCode}
        errorMessage={this.props.errorMessage}
        onBack={this.props.onBack}
        onSubmit={() => this.props.onSubmit({
          cardNumber: new HiddenString(this.state.cardNumber || ''),
          nameOnCard: new HiddenString(this.state.name || ''),
          securityCode: new HiddenString(this.state.securityCode || ''),
          cardExpMonth: new HiddenString(parsedExpiration.month),
          cardExpYear: new HiddenString(parsedExpiration.year),
        })}
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
    onBootstrap: () => { dispatch(actions.bootstrapData()) },
    onSubmit: (args) => { dispatch(actions.updateBilling(args)) },
    clearBillingError: () => { dispatch(actions.clearBillingError()) },
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
        onSubmit: dispatchProps.onSubmit,
        // TODO(mm) make this an action that sets the error field correctly
        parseExpiration: parseExpiration,
        clearBillingError: dispatchProps.clearBillingError,
      },
    }
  }
)(Bootstrapable(PaymentStateHolder))
