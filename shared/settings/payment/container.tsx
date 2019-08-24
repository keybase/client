import logger from '../../logger'
import * as actions from '../../actions/plan-billing'
import Bootstrapable from '../../util/bootstrapable'
import HiddenString from '../../util/hidden-string'
import Payment from './index'
import React, {Component} from 'react'
import {connect, TypedState} from '../../util/container'
import {parseExpiration} from '../../constants/plan-billing'

type OwnProps = {}

type State = {
  cardNumber: string | null
  name: string | null
  expiration: string | null
  securityCode: string | null
}

type Props = {
  errorMessage?: string | null
  clearBillingError: () => void
  onBack: () => void
  onSubmit: (
    cardNumber: string | null,
    name: string | null,
    securityCode: string | null,
    expiration: string | null
  ) => void
}

class PaymentStateHolder extends Component<Props, State> {
  state: State
  constructor(props) {
    super(props)
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

export default connect(
  (state: TypedState, _: OwnProps) => {
    const {
      // @ts-ignore doesn't exist
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
  (dispatch: (a: any) => void, _: OwnProps) => ({
    clearBillingError: () => {
      // @ts-ignore
      dispatch(actions.clearBillingError())
    },
    onBootstrap: () => {
      // @ts-ignore
      dispatch(actions.bootstrapData())
    },
    onSubmit: args => {
      // @ts-ignore
      dispatch(actions.updateBilling(args))
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
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
        onSubmit: (
          cardNumber: string | null,
          name: string | null,
          securityCode: string | null,
          expiration: string | null
        ) => {
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
