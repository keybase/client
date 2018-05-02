// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import {Box2, ClickableBox, Icon, Text} from '../../common-adapters'
import {globalMargins} from '../../styles'

export type Props = {
  availableToSend: string, // non-empty only if native currency
  balance: string,
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
              <Text type="BodySemibold">{props.name}</Text>
              <Text type="BodySmall">{props.issuer}</Text>
            </Box2>
          </Box2>
          <Box2 direction="vertical" style={balanceContainerStyle} fullHeight={true}>
            <Text type="BodySemibold" style={{color: '#814cf4', fontWeight: '800'}}>
              {props.balance}
            </Text>
            <Text type="BodySmall">{props.equivBalance}</Text>
          </Box2>
        </Box2>
      </ClickableBox>
      {props.expanded && (
        <Box2 direction="horizontal" fullWidth={true}>
          {props.reserves.length && (
            <BalanceSummary
              availableToSend={props.availableToSend}
              equivAvailableToSend={props.equivAvailableToSend}
              reserves={props.reserves}
              total={props.balance}
            />
          )}
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
    <Text type="BodySmall">{props.equivAvailableToSend}</Text>
  </Box2>
)

const balanceSummaryContainerStyle = {
  flexBasis: 355,
}

export default Asset
