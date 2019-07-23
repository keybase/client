import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import PaymentPathCircle, {pathCircleDiameter} from '../common/payment-path-circle'

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
    style={styles.paymentPathStop}
  >
    <PaymentPathCircle />
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
    style={styles.paymentPathStop}
  >
    <PaymentPathCircle />
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
    <PaymentPathCircle />
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
    {props.pathIntermediate.map((asset, i) => {
      // If we don't have a code, then the asset is lumens
      const code = asset.code || 'XLM'
      const issuer =
        code === 'XLM'
          ? 'Stellar Lumens'
          : asset.issuerVerifiedDomain ||
            (asset.issuerAccountID === Types.noAccountID
              ? 'Unknown issuer'
              : Constants.shortenAccountID(asset.issuerAccountID))
      return (
        <React.Fragment key={i}>
          <PaymentPathStop assetCode={code} issuer={issuer} />
          <Kb.Box style={styles.paymentPathLine} />
        </React.Fragment>
      )
    })}
    <PaymentPathEnd assetLabel={props.destinationAmount} issuer={props.destinationIssuer} />
  </Kb.Box2>
)

export default PaymentPath

// text line height can vary, so set it to an upper bound here
// we can then calculate negative margin from this height so that there are no gaps between the
// circles and lines
const pathTextHeight = 22

const styles = Styles.styleSheetCreate({
  paymentPathEndText: {
    color: Styles.globalColors.greenDark,
  },
  paymentPathLine: {
    backgroundColor: Styles.globalColors.purpleLight,
    height: Styles.globalMargins.medium,
    // Line width is 2, so to center it between the large circle, divide by 2 and subtract half the width
    marginLeft: pathCircleDiameter / 2 - 1,
    marginRight: pathCircleDiameter / 2 - 1,
    width: 2,
  },
  paymentPathStop: {
    height: pathTextHeight,
    marginBottom: (pathCircleDiameter - pathTextHeight) / 2,
    // Center the small circle
    marginLeft: pathCircleDiameter / 2 - pathCircleDiameter / 2,
    marginTop: (pathCircleDiameter - pathTextHeight) / 2,
  },
})
