import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type Props = {
  isLarge: boolean
  style?: Styles.StylesCrossPlatform
}

const PaymentPathCircle = (props: Props) => (
  <Kb.Box
    style={Styles.collapseStyles([
      props.isLarge && styles.paymentPathCircleLarge,
      !props.isLarge && styles.paymentPathCircleSmall,
      props.style,
    ])}
  />
)
export default PaymentPathCircle

export const pathCircleLargeDiameter = 18
export const pathCircleSmallDiameter = 10

const styles = Styles.styleSheetCreate({
  paymentPathCircleLarge: {
    backgroundColor: Styles.globalColors.purple,
    borderColor: Styles.globalColors.purpleLighter,
    borderRadius: pathCircleLargeDiameter / 2,
    borderStyle: 'solid',
    borderWidth: 3,
    height: pathCircleLargeDiameter,
    width: pathCircleLargeDiameter,
  },
  paymentPathCircleSmall: {
    backgroundColor: Styles.globalColors.purple,
    borderColor: Styles.globalColors.purpleLighter,
    borderRadius: pathCircleSmallDiameter / 2,
    borderStyle: 'solid',
    borderWidth: 2,
    height: pathCircleSmallDiameter,
    width: pathCircleSmallDiameter,
  },
})
