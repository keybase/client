// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Status = 'error' | 'pending' | 'completed'

type Props = {
  allowFontScaling?: ?boolean,
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

const PaymentStatus = (props: Props) => (
  <Kb.Text type="BodyExtrabold" allowFontScaling={!!props.allowFontScaling} style={styles[props.status]}>
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
  completed: {
    backgroundColor: Styles.globalColors.purple2_10,
    borderRadius: Styles.globalMargins.xxtiny,
    color: Styles.globalColors.purple2,
  },
  completedIcon: {
    color: Styles.globalColors.purple2,
  },
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
