import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type Props = {
  style?: Styles.StylesCrossPlatform
}

const PaymentPathCircle = (props: Props) => (
  <Kb.Box style={Styles.collapseStyles([styles.paymentPathCircle, props.style])} />
)
export default PaymentPathCircle

export const pathCircleDiameter = 10

const styles = Styles.styleSheetCreate({
  paymentPathCircle: {
    backgroundColor: Styles.globalColors.purple,
    borderColor: Styles.globalColors.purpleLighter,
    borderRadius: pathCircleDiameter / 2,
    borderStyle: 'solid',
    borderWidth: 2,
    height: pathCircleDiameter,
    width: pathCircleDiameter,
  },
})
