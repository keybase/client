// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as WalletTypes from '../../../constants/types/wallets'
import {SendPaymentPopup} from '../../conversation/messages/message-popup/payment/container'

type Status = 'error' | 'pending' | 'completed'

type State = {
  showPopup: boolean,
}

type Props = {
  allowFontScaling?: ?boolean,
  message: TypeError.Message,
  worthDescription: string,
  paymentID: WalletTypes.PaymentID,
  status: Status,
  text: string,
}

const getIcon = status => {
  switch (status) {
    case 'completed':
      return 'iconfont-success'
    case 'pending':
      return 'iconfont-time'
    case 'error':
      return 'iconfont-remove'
    default:
      return 'iconfont-time'
  }
}

class PaymentStatus extends React.Component<Props, State> {
  statusRef: any
  state = {showPopup: false}
  constructor(props: Props) {
    super(props)
    this.statusRef = React.createRef()
  }
  _onMouseOver = () => {
    this.setState({showPopup: true})
  }
  _onMouseLeave = () => {
    this.setState({showPopup: false})
  }
  _getAttachmentRef = () => {
    return this.statusRef.current
  }
  render() {
    return (
      <Kb.Box2
        style={styles.container}
        direction="horizontal"
        onMouseOver={this._onMouseOver}
        onMouseLeave={this._onMouseLeave}
      >
        <Kb.Text
          ref={this.statusRef}
          type="BodyExtrabold"
          allowFontScaling={!!this.props.allowFontScaling}
          style={styles[this.props.status]}
        >
          {' '}
          {this.props.text}{' '}
          <Kb.Icon
            type={getIcon(this.props.status)}
            fontSize={12}
            boxStyle={styles.iconBoxStyle}
            style={styles[this.props.status + 'Icon']}
          />{' '}
        </Kb.Text>
        <SendPaymentPopup
          attachTo={this._getAttachmentRef}
          visible={this.state.showPopup}
          paymentID={this.props.paymentID}
          message={this.props.message}
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  completed: {
    backgroundColor: Styles.globalColors.purple2_10,
    borderRadius: Styles.globalMargins.xxtiny,
    color: Styles.globalColors.purple2,
  },
  completedIcon: {
    color: Styles.globalColors.purple2,
  },
  container: Styles.platformStyles({
    isElectron: {
      display: 'inline',
    },
  }),
  error: {
    backgroundColor: Styles.globalColors.red_10,
    borderRadius: Styles.globalMargins.xxtiny,
    color: Styles.globalColors.red,
  },
  errorIcon: {
    color: Styles.globalColors.red,
  },
  iconBoxStyle: Styles.platformStyles({
    isElectron: {
      display: 'inline',
    },
  }),
  pending: {
    backgroundColor: Styles.globalColors.black_05,
    borderRadius: Styles.globalMargins.xxtiny,
    color: Styles.globalColors.black_40,
  },
  pendingIcon: {},
})

export default PaymentStatus
