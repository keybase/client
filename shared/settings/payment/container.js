// @flow
import logger from '../../logger'
import * as actions from '../../actions/plan-billing'
import Bootstrapable from '../../util/bootstrapable'
import HiddenString from '../../util/hidden-string'
import Payment from './index'
import React, {Component} from 'react'
import {connect, type TypedState} from '../../util/container'
import {parseExpiration} from '../../constants/plan-billing'

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

class PaymentStateHolder extends Component<Props, State> {
  state: State
  constructor() {
    super()
    this.state = {
      cardNumber: null,
      expiration: null,
      name: null,
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
          )
        }
      />
    )
  }
}

export default connect<OwnProps, _, _, _, _>(
  (state: TypedState, ownProps: OwnProps) => {
    const {
      // $FlowIssue
      planBilling: {plan, errorMessage},
    } = state
    if (!plan) {
      return {
        bootstrapDone: false,
      }
    }

    return {
      bootstrapDone: true,
      originalProps: {
        errorMessage: errorMessage,
        onBack: () => logger.debug('todo'),
      },
    }
  },
  (dispatch: (a: any) => void, ownProps: OwnProps) => ({
    clearBillingError: () => {
      dispatch(actions.clearBillingError())
    },
    onBootstrap: () => {
      dispatch(actions.bootstrapData())
    },
    onSubmit: args => {
      dispatch(actions.updateBilling(args))
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
        clearBillingError: dispatchProps.clearBillingError,
        onSubmit: (cardNumber: ?string, name: ?string, securityCode: ?string, expiration: ?string) => {
          const parsedExpiration = parseExpiration(expiration || '')
          dispatchProps.onSubmit({
            cardExpMonth: new HiddenString(parsedExpiration.month),
            cardExpYear: new HiddenString(parsedExpiration.year),
            cardNumber: new HiddenString(cardNumber || ''),
            nameOnCard: new HiddenString(name || ''),
            securityCode: new HiddenString(securityCode || ''),
          })
        },
      },
    }
  }
)(Bootstrapable(PaymentStateHolder))
