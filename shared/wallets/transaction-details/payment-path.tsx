import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/wallets'

interface CounterpartyIconProps {
  counterpartyType: Types.CounterpartyType
  counterparty: string
}

interface PaymentPathStartProps {
  you: string
  assetLabel: string
  issuer: string
  counterpartyType: Types.CounterpartyType
}

interface PaymentPathEndProps {
  assetLabel: string
  issuer: string
  counterpartyType: Types.CounterpartyType
}

interface PaymentPathProps {

}

const CounterpartyIcon = (props: CounterpartyIconProps) => {
  switch (props.counterpartyType) {
    case 'keybaseUser':
      return (
        <Kb.Avatar username={props.counterparty} size={32} borderColor={Styles.globalColors.purpleLight} />
      )
    case 'stellarPublicKey':
      return (
        <Kb.Icon
          type="icon-placeholder-secret-user-32"
          style={{
            ...styles.icon32,
            borderColor: Styles.globalColors.purpleLight,
            borderRadius: 32 / 2,
            borderStyle: 'solid',
            borderWidth: 2,
          }}
        />
      )
    case 'otherAccount':
      return <Kb.Icon type="icon-wallet-32" style={styles.icon32} />
    default:
      throw new Error(`unknown counterpartyType: ${props}`)
  }
}

const PaymentPathStart = (props: PaymentPathStartProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="small">
    {props.counterpartyType === 'otherAccount' ? (
      <Kb.Icon type="icon-wallet-32" style={styles.icon32} />
    ) : (
      <Kb.Avatar username={props.you} size={32} borderColor={Styles.globalColors.purpleLight} />
    )}
    <Kb.Text type="BodyBigExtrabold">
      -{props.assetLabel}
      <Kb.Text type="BodySmall">/{props.issuer}</Kb.Text>
    </Kb.Text>
  </Kb.Box2>
)

const PaymentPathEnd = (props: PaymentPathEndProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="small">
    <CounterpartyIcon counterpartyType={props.counterpartyType} counterparty={props.counterparty} />
    <Kb.Text type="BodyBigExtrabold" style={{color: Styles.globalColors.greenDark}}>
      +{props.assetLabel}
      <Kb.Text type="BodySmall">/{props.issuer}</Kb.Text>
    </Kb.Text>
  </Kb.Box2>
)

const PaymentPathStop = (props: {assetCode: string; issuer: string}) => (
  <Kb.Box2
    direction="horizontal"
    style={styles.paymentPathStop}
    alignItems="center"
    fullWidth={true}
    gap="medium"
  >
    <Kb.Box style={styles.paymentPathCircle} />
    <Kb.Text type="BodyBigExtrabold">
      {props.assetCode}
      <Kb.Text type="BodySmall">/{props.issuer}</Kb.Text>
    </Kb.Text>
  </Kb.Box2>
)

const PaymentPath = (props: any) => {
  return (
    <Kb.Box2 direction="vertical" alignSelf="flex-start" alignItems="flex-start">
      <PaymentPathStart you={props.you} assetLabel={props.sourceAmount} issuer={props.sourceIssuer} />
      <Kb.Box style={styles.paymentPathLine} />
      {props.pathIntermediate.map(asset => {
        return (
          <>
            <PaymentPathStop assetCode={asset.code} issuer={asset.issuerVerifiedDomain || 'Unknown issuer'} />
            <Kb.Box style={styles.paymentPathLine} />
          </>
        )
      })}
      <PaymentPathEnd assetLabel={props.amountDescription} issuer={props.destinationIssuer} />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  icon32: {height: 32, width: 32},
  paymentPathCircle: {
    backgroundColor: Styles.globalColors.purple,
    borderColor: Styles.globalColors.purpleLighter,
    borderRadius: 10 / 2,
    borderStyle: 'solid',
    borderWidth: 2,
    height: 10,
    width: 10,
  },
  paymentPathLine: {
    backgroundColor: Styles.globalColors.purpleLight,
    height: Styles.globalMargins.medium,
    marginLeft: 15,
    marginRight: 15,
    width: 2,
  },
  paymentPathStop: {marginBottom: -4.5, marginLeft: 11, marginTop: -4.5},
})
