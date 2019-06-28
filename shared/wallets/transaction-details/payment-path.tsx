import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/wallets'

type PaymentPathStartProps = {
  assetLabel: string
  issuer: string
}

type PaymentPathEndProps = {
  assetLabel: string
  issuer: string
}

type PaymentPathStopProps = {
  assetCode: string
  issuer: string
}

type PaymentPathProps = {
  sourceAmount: string
  sourceIssuer: string
  pathIntermediate: I.List<Types.AssetDescription>
  destinationAmount: string
  destinationIssuer: string
}

const PaymentPathStart = (props: PaymentPathStartProps) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    alignItems="center"
    gap="small"
    style={styles.paymentPathStartOrEnd}
  >
    <Kb.Box style={styles.paymentPathCircleLarge} />
    <Kb.Text type="BodyBigExtrabold">
      -{props.assetLabel}
      <Kb.Text type="BodySmall">/{props.issuer}</Kb.Text>
    </Kb.Text>
  </Kb.Box2>
)

const PaymentPathEnd = (props: PaymentPathEndProps) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    alignItems="center"
    gap="small"
    style={styles.paymentPathStartOrEnd}
  >
    <Kb.Box style={styles.paymentPathCircleLarge} />
    <Kb.Text type="BodyBigExtrabold" style={styles.paymentPathEndText}>
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

const PaymentPath = (props: PaymentPathProps) => (
  <Kb.Box2 direction="vertical" alignSelf="flex-start" alignItems="flex-start">
    <PaymentPathStart assetLabel={props.sourceAmount} issuer={props.sourceIssuer} />
    <Kb.Box style={styles.paymentPathLine} />
    {props.pathIntermediate.map((asset, i) => (
      <React.Fragment key={i}>
        <PaymentPathStop assetCode={asset.code} issuer={asset.issuerVerifiedDomain || 'Unknown issuer'} />
        <Kb.Box style={styles.paymentPathLine} />
      </React.Fragment>
    ))}
    <PaymentPathEnd assetLabel={props.destinationAmount} issuer={props.destinationIssuer} />
  </Kb.Box2>
)

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
  paymentPathEndText: {
    color: Styles.globalColors.greenDark,
  },
  paymentPathLine: {
    backgroundColor: Styles.globalColors.purpleLight,
    height: Styles.globalMargins.medium,
    // Line width is 2, so to center it between the large circle, divide by 2 and subtract half the width
    marginLeft: pathCircleLargeDiameter / 2 - 1,
    marginRight: pathCircleLargeDiameter / 2 - 1,
    width: 2,
  },
  paymentPathStartOrEnd: {
    // The text gives each stop a line height of 19, the negative margin offsets that so there are no gaps between the lines and circles
    // On mobile, it's 21
    marginBottom: (pathCircleLargeDiameter - (Styles.isMobile ? 21 : 19)) / 2,
    marginTop: (pathCircleLargeDiameter - (Styles.isMobile ? 21 : 19)) / 2,
  },
  paymentPathStop: {
    marginBottom: (pathCircleSmallDiameter - (Styles.isMobile ? 21 : 19)) / 2,
    // Center the small circle
    marginLeft: pathCircleLargeDiameter / 2 - pathCircleSmallDiameter / 2,
    marginTop: (pathCircleSmallDiameter - (Styles.isMobile ? 21 : 19)) / 2,
  },
})
