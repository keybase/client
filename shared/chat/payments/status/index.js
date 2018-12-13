// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as WalletTypes from '../../../constants/types/wallets'

type Status = 'error' | 'pending' | 'success'

type Props = {
  status: WalletTypes.StatusSimplified,
  text: string,
}

const getIcon = status => {
  switch (status) {
    case 'success':
      return 'iconfont-success'
    case 'pending':
      return 'iconfont-time'
    case 'error':
      return 'iconfont-remove'
    default:
      return 'iconfont-time'
  }
}

const PaymentStatus = (props: Props) => (
  <Kb.Text type="BodyExtrabold" style={styles[props.status]}>
    {props.text}{' '}
    <Kb.Icon
      type={getIcon(props.status)}
      fontSize={12}
      boxStyle={styles.iconBoxStyle}
      style={styles[props.status + 'Icon']}
    />
  </Kb.Text>
)

const styles = Styles.styleSheetCreate({
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
  success: {
    backgroundColor: Styles.globalColors.purple2_10,
    borderRadius: Styles.globalMargins.xxtiny,
    color: Styles.globalColors.purple2,
  },
  successIcon: {
    color: Styles.globalColors.purple2,
  },
})

export default PaymentStatus
