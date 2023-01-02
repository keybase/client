import * as React from 'react'
import * as Styles from '../../../styles'
import type * as Types from '../../../constants/types/chat2'
import type * as WalletTypes from '../../../constants/types/wallets'
import {SendPaymentPopup} from '../../conversation/messages/message-popup/payment/container'
import PaymentStatusError from './error'
import Text from '../../../common-adapters/text'
import {Box2} from '../../../common-adapters/box'
import Icon from '../../../common-adapters/icon'

// This is actually a dependency of common-adapters/markdown so we have to treat it like a common-adapter, no * import allowed
const Kb = {
  Box2,
  Icon,
  Text,
}

type Status = 'error' | 'pending' | 'completed' | 'claimable'

type State = {
  showPopup: boolean
}

export type Props = {
  allowFontScaling?: boolean | null
  allowPopup: boolean
  errorDetail?: string
  isSendError: boolean
  message: Types.MessageText
  paymentID?: WalletTypes.PaymentID
  status: Status
  text: string
}

const getIcon = (status: Status) => {
  switch (status) {
    case 'completed':
      return 'iconfont-success'
    case 'claimable':
      return 'iconfont-success'
    case 'pending':
      return 'iconfont-clock'
    case 'error':
      return 'iconfont-remove'
    default:
      return 'iconfont-clock'
  }
}

const statusColor = (s: Status) => {
  switch (s) {
    case 'completed':
      return Styles.globalColors.purpleDarkOrWhite
    case 'claimable':
      return undefined
    case 'pending':
      return Styles.globalColors.black_50OrWhite
    case 'error':
      return Styles.globalColors.redDarkOrWhite
  }
}

class PaymentStatus extends React.Component<Props, State> {
  statusRef: any
  state = {showPopup: false}
  constructor(props: Props) {
    super(props)
    this.statusRef = React.createRef()
  }
  _showPopup = () => {
    if (this.props.allowPopup) {
      this.setState({showPopup: true})
    }
  }
  _hidePopup = () => {
    this.setState({showPopup: false})
  }
  _getAttachmentRef = () => {
    return this.statusRef.current
  }
  render() {
    const text = (
      <Kb.Text
        ref={this.statusRef}
        type="BodyExtrabold"
        allowFontScaling={!!this.props.allowFontScaling}
        onClick={this._showPopup}
      >
        {' '}
        <Kb.Text
          type="BodyExtrabold"
          allowFontScaling={!!this.props.allowFontScaling}
          style={styles[this.props.status]}
        >
          {this.props.text}{' '}
          <Kb.Icon
            type={getIcon(this.props.status)}
            fontSize={12}
            boxStyle={styles.iconBoxStyle}
            color={statusColor(this.props.status)}
          />
        </Kb.Text>{' '}
      </Kb.Text>
    )
    const popups = this.props.isSendError ? (
      <PaymentStatusError
        attachTo={this._getAttachmentRef}
        error={this.props.errorDetail || ''}
        onHidden={this._hidePopup}
        visible={this.state.showPopup}
      />
    ) : (
      <SendPaymentPopup
        attachTo={this._getAttachmentRef}
        visible={this.state.showPopup}
        paymentID={this.props.paymentID}
        position="top center"
        ordinal={this.props.message.id}
        message={this.props.message}
        conversationIDKey={this.props.message.conversationIDKey}
        onHidden={this._hidePopup}
      />
    )
    return Styles.isMobile ? (
      <>
        {text}
        {popups}
      </>
    ) : (
      <Kb.Box2
        style={styles.container}
        direction="horizontal"
        onMouseOver={this._showPopup}
        onMouseLeave={this._hidePopup}
      >
        {text}
        {popups}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      claimable: {
        backgroundColor: Styles.globalColors.purple_10OrPurple,
        borderRadius: Styles.globalMargins.xxtiny,
        color: Styles.globalColors.purpleDarkOrWhite,
        paddingLeft: Styles.globalMargins.xtiny,
        paddingRight: Styles.globalMargins.xtiny,
      },
      completed: {
        backgroundColor: Styles.globalColors.purple_10OrPurple,
        borderRadius: Styles.globalMargins.xxtiny,
        color: Styles.globalColors.purpleDarkOrWhite,
        paddingLeft: Styles.globalMargins.xtiny,
        paddingRight: Styles.globalMargins.xtiny,
      },
      container: Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
        },
      }),
      error: {
        backgroundColor: Styles.globalColors.red_10OrRed,
        borderRadius: Styles.globalMargins.xxtiny,
        color: Styles.globalColors.redDarkOrWhite,
        paddingLeft: Styles.globalMargins.xtiny,
        paddingRight: Styles.globalMargins.xtiny,
      },
      iconBoxStyle: Styles.platformStyles({
        isElectron: {
          display: 'inline',
        },
      }),
      pending: {
        backgroundColor: Styles.globalColors.greyLight,
        borderRadius: Styles.globalMargins.xxtiny,
        color: Styles.globalColors.black_50OrWhite,
        paddingLeft: Styles.globalMargins.xtiny,
        paddingRight: Styles.globalMargins.xtiny,
      },
    } as const)
)

export default PaymentStatus
