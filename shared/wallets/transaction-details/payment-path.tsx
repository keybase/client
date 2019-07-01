import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/wallets'

export type Asset = {
  code: string
  issuerAccountID: string
  issuerName: string
  issuerVerifiedDomain: string
}

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
  pathIntermediate: Asset[]
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
// text line height can vary, so set it to an upper bound here
// we can then calculate negative margin from this height so that there are no gaps between the
// circles and lines
const pathTextHeight = 22

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
    height: pathTextHeight,
    marginBottom: (pathCircleLargeDiameter - pathTextHeight) / 2,
    marginTop: (pathCircleLargeDiameter - pathTextHeight) / 2,
  },
  paymentPathStop: {
    height: pathTextHeight,
    marginBottom: (pathCircleSmallDiameter - pathTextHeight) / 2,
    // Center the small circle
    marginLeft: pathCircleLargeDiameter / 2 - pathCircleSmallDiameter / 2,
    marginTop: (pathCircleSmallDiameter - pathTextHeight) / 2,
  },
})
