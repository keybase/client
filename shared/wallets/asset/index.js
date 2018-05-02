// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import {Box2, ClickableBox, Divider, Icon, Text} from '../../common-adapters'
import {globalMargins} from '../../styles'

export type Props = {
  availableToSend: string, // non-empty only if native currency
  balance: string,
  code: string, // The same as `name` except for XLM
  equivAvailableToSend: string, // non-empty only if native currency e.g. '$123.45 USD'
  equivBalance: string, // non-empty only if native currency
  expanded: boolean,
  issuer: string, // verified issuer domain name, 'Stellar network' or 'Unknown'
  issuerAddress: string, // issuing public key
  name: string, // Asset code or 'Lumens'
  reserves: Types.Reserve[], // non-empty only if native currency
  toggleExpanded: () => void,
}

export const Asset = (props: Props) => {
  const caratType = props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'
  return (
    <Box2 direction="vertical" fullWidth={true}>
      <ClickableBox onClick={props.toggleExpanded}>
        <Box2 direction="horizontal" fullWidth={true} style={headerContainerStyle}>
          <Box2 direction="horizontal" gap="tiny" style={labelContainerStyle}>
            <Icon type={caratType} style={{lineHeight: 2}} />
            <Box2 direction="vertical">
              <Text type="BodySemibold" lineClamp={1}>
                {props.name}
              </Text>
              <Text type="BodySmall" lineClamp={1}>
                {props.issuer}
              </Text>
            </Box2>
          </Box2>
          <Box2 direction="vertical" style={balanceContainerStyle} fullHeight={true}>
            <Text type="BodySemibold" lineClamp={1} style={{color: '#814cf4', fontWeight: '800'}}>
              {props.balance} {props.code}
            </Text>
            <Text type="BodySmall" lineClamp={1}>
              {props.equivBalance}
            </Text>
          </Box2>
        </Box2>
      </ClickableBox>
      {props.expanded && (
        <Box2
          direction="horizontal"
          fullWidth={true}
          style={{
            justifyContent: 'flex-end',
            paddingBottom: globalMargins.tiny,
            paddingRight: globalMargins.small,
          }}
        >
          {!!props.reserves.length && (
            <BalanceSummary
              availableToSend={props.availableToSend}
              equivAvailableToSend={props.equivAvailableToSend}
              reserves={props.reserves}
              total={props.balance}
            />
          )}
          {!!props.issuerAddress && <IssuerAddress issuerAddress={props.issuerAddress} />}
        </Box2>
      )}
    </Box2>
  )
}

const headerContainerStyle = {
  height: 48,
  padding: globalMargins.tiny,
  paddingRight: globalMargins.small,
}

const labelContainerStyle = {
  flex: 1,
}

const balanceContainerStyle = {
  alignItems: 'flex-end',
  justifyContent: 'flex-start',
}

type BalanceSummaryProps = {
  availableToSend: string,
  equivAvailableToSend: string,
  reserves: Types.Reserve[],
  total: string,
}

const BalanceSummary = (props: BalanceSummaryProps) => (
  <Box2 direction="vertical" fullWidth={true} style={balanceSummaryContainerStyle}>
    <Divider style={{marginBottom: globalMargins.tiny}} />
    <Box2 direction="horizontal" fullWidth={true}>
      <Text type="BodySemibold" style={leftColTextStyle}>
        Total
      </Text>
      <Text type="Body" selectable={true} style={markerBalanceTextStyle}>
        {props.total}
      </Text>
    </Box2>
    {props.reserves.map(reserve => (
      <Box2 direction="horizontal" fullWidth={true} key={reserve.description}>
        <Text type="Body" lineClamp={1} style={leftColTextStyle}>
          Reserve ({reserve.description})
        </Text>
        <Text type="Body" lineClamp={1} selectable={true}>
          -{reserve.amount}
        </Text>
      </Box2>
    ))}
    <Divider style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny}} />
    <Box2 direction="horizontal" fullWidth={true} style={{alignItems: 'flex-start'}}>
      <Text type="BodySemibold" style={leftColTextStyle}>
        Available to send
      </Text>
      <Box2 direction="vertical" style={balanceContainerStyle}>
        <Text type="Body" selectable={true} style={{fontWeight: '800'}}>
          {props.availableToSend}
        </Text>
        <Text type="BodySmall">{props.equivAvailableToSend}</Text>
      </Box2>
    </Box2>
  </Box2>
)

const balanceSummaryContainerStyle = {
  flexBasis: 355,
}

const leftColTextStyle = {
  flex: 1,
}

// TEMP until new text type
const markerBalanceTextStyle = {
  fontWeight: '800',
}

type IssuerAddressProps = {
  issuerAddress: string,
}

const IssuerAddress = (props: IssuerAddressProps) => (
  <Box2 direction="vertical" fullWidth={true} style={balanceSummaryContainerStyle}>
    <Text type="Body">Issuer:</Text>
    <Text type="Body" selectable={true}>
      {/* TODO (DA) make the full address copyable */}
      {props.issuerAddress.substr(0, 12) +
        '..........' +
        props.issuerAddress.substr(props.issuerAddress.length - 12)}
    </Text>
  </Box2>
)

export default Asset
