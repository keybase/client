// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import {Box2, ClickableBox, Divider, Icon, Text} from '../../common-adapters'
import {globalMargins, platformStyles, styleSheetCreate} from '../../styles'

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

// TODO (DA) swap out these text styles and hard coded colors for when they're added
// to globalColors and text types

export const Asset = (props: Props) => {
  const caretType = props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'
  return (
    <Box2 direction="vertical" fullWidth={true}>
      <ClickableBox onClick={props.toggleExpanded}>
        <Box2 direction="horizontal" fullWidth={true} style={styles.headerContainer}>
          <Box2 direction="horizontal" gap="tiny" style={styles.labelContainer}>
            <Icon type={caretType} style={styles.caret} />
            <Box2 direction="vertical">
              <Text type="BodySemibold" lineClamp={1}>
                {props.name}
              </Text>
              <Text type="BodySmall" lineClamp={1}>
                {props.issuer}
              </Text>
            </Box2>
          </Box2>
          <Box2 direction="vertical" style={styles.balanceContainer} fullHeight={true}>
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
        <Box2 direction="horizontal" fullWidth={true} style={styles.expandedRowContainer}>
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

type BalanceSummaryProps = {
  availableToSend: string,
  equivAvailableToSend: string,
  reserves: Types.Reserve[],
  total: string,
}

const BalanceSummary = (props: BalanceSummaryProps) => (
  <Box2 direction="vertical" fullWidth={true} style={styles.balanceSummaryContainer}>
    <Divider style={{marginBottom: globalMargins.tiny}} />
    <Box2 direction="horizontal" fullWidth={true}>
      <Text type="BodySemibold" style={styles.leftColText}>
        Total
      </Text>
      <Text type="Body" selectable={true} style={styles.markerBalanceText}>
        {props.total}
      </Text>
    </Box2>
    {props.reserves.map(reserve => (
      <Box2 direction="horizontal" fullWidth={true} key={reserve.description}>
        <Text type="Body" lineClamp={1} style={styles.leftColText}>
          Reserve ({reserve.description})
        </Text>
        <Text type="Body" lineClamp={1} selectable={true}>
          -{reserve.amount}
        </Text>
      </Box2>
    ))}
    <Divider style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny}} />
    <Box2 direction="horizontal" fullWidth={true} style={{alignItems: 'flex-start'}}>
      <Text type="BodySemibold" style={styles.leftColText}>
        Available to send
      </Text>
      <Box2 direction="vertical" style={styles.balanceContainer}>
        <Text type="Body" selectable={true} style={{fontWeight: '800'}}>
          {props.availableToSend}
        </Text>
        <Text type="BodySmall">{props.equivAvailableToSend}</Text>
      </Box2>
    </Box2>
  </Box2>
)

type IssuerAddressProps = {
  issuerAddress: string,
}

const IssuerAddress = (props: IssuerAddressProps) => (
  <Box2 direction="vertical" fullWidth={true} style={styles.balanceSummaryContainer}>
    <Text type="Body">Issuer:</Text>
    <Text type="Body" selectable={true}>
      {/* TODO (DA) make the full address copyable */}
      {props.issuerAddress.substr(0, 12) +
        '..........' +
        props.issuerAddress.substr(props.issuerAddress.length - 12)}
    </Text>
  </Box2>
)

const styles = styleSheetCreate({
  headerContainer: {
    height: 48,
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small,
  },
  labelContainer: {
    flex: 1,
  },
  caret: platformStyles({
    isElectron: {lineHeight: '2'},
    isMobile: {marginTop: 6},
  }),
  balanceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  expandedRowContainer: {
    justifyContent: 'flex-end',
    paddingBottom: globalMargins.tiny,
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.small,
  },
  balanceSummaryContainer: {
    flexBasis: 355,
    flexShrink: 1,
  },
  leftColText: {
    flex: 1,
  },
  // TEMP until new text type
  markerBalanceText: {
    fontWeight: '800',
  },
})

export default Asset
