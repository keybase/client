import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/wallets'

interface PaymentPathStartProps {
  assetLabel: string
  issuer: string
}

interface PaymentPathEndProps {
  assetLabel: string
  issuer: string
}

interface PaymentPathStopProps {
  assetCode: string
  issuer: string
}

interface PaymentPathProps {
  sourceAmount: string
  sourceIssuer: string
  pathIntermediate: I.List<Types.AssetDescription>
  destinationAmount: string
  destinationIssuer: string
}

const PaymentPathStart = (props: PaymentPathStartProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="small">
    <Kb.Box style={styles.paymentPathCircleLarge} />
    <Kb.Text type="BodyBigExtrabold">
      -{props.assetLabel}
      <Kb.Text type="BodySmall">/{props.issuer}</Kb.Text>
    </Kb.Text>
  </Kb.Box2>
)

const PaymentPathEnd = (props: PaymentPathEndProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="small">
    <Kb.Box style={styles.paymentPathCircleLarge} />
    <Kb.Text type="BodyBigExtrabold" style={{color: Styles.globalColors.greenDark}}>
      +{props.assetLabel}
      <Kb.Text type="BodySmall">/{props.issuer}</Kb.Text>
    </Kb.Text>
  </Kb.Box2>
)

const PaymentPathStop = (props: PaymentPathStopProps) => (
  <Kb.Box2
    direction="horizontal"
    style={styles.paymentPathStop}
    alignItems="center"
    fullWidth={true}
    gap="medium"
  >
    <Kb.Box style={styles.paymentPathCircleSmall} />
    <Kb.Text type="BodyBigExtrabold">
      {props.assetCode}
      <Kb.Text type="BodySmall">/{props.issuer}</Kb.Text>
    </Kb.Text>
  </Kb.Box2>
)

const PaymentPath = (props: PaymentPathProps) => {
  return (
    <Kb.Box2 direction="vertical" alignSelf="flex-start" alignItems="flex-start">
      <PaymentPathStart assetLabel={props.sourceAmount} issuer={props.sourceIssuer} />
      <Kb.Box style={styles.paymentPathLine} />
      {props.pathIntermediate.map(asset => {
        return (
          <>
            <PaymentPathStop assetCode={asset.code} issuer={asset.issuerVerifiedDomain || 'Unknown issuer'} />
            <Kb.Box style={styles.paymentPathLine} />
          </>
        )
      })}
      <PaymentPathEnd assetLabel={props.destinationAmount} issuer={props.destinationIssuer} />
    </Kb.Box2>
  )
}

export default PaymentPath

const pathCircleLargeDiameter = 18
const pathCircleSmallDiameter = 10

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
  paymentPathLine: {
    backgroundColor: Styles.globalColors.purpleLight,
    height: Styles.globalMargins.medium,
    // Line width is 2, so to center it between the large circle, divide by 2 and subtract half the width
    marginLeft: pathCircleLargeDiameter / 2 - 1,
    marginRight: pathCircleLargeDiameter / 2 - 1,
    width: 2,
  },
  paymentPathStop: {
    marginBottom: -4.5,
    // Center the small circle
    marginLeft: pathCircleLargeDiameter / 2 - pathCircleSmallDiameter / 2,
    marginTop: -4.5,
  },
})
