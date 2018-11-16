// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import openURL from '../../util/open-url'
import {Box2, ClickableBox, Divider, Icon, Text, WithTooltip, iconCastPlatformStyles} from '../../common-adapters'
import {globalColors, globalMargins, isMobile, platformStyles, styleSheetCreate} from '../../styles'

export type Props = {
  availableToSend: string, // non-empty only if native currency
  balance: string,
  code: string, // The same as `name` except for XLM
  equivAvailableToSend: string, // non-empty only if native currency e.g. '$123.45 USD'
  equivBalance: string, // non-empty only if native currency
  issuerName: string, // verified issuer domain name, 'Stellar network' or 'Unknown'
  issuerAccountID: string, // issuing public key
  name: string, // Asset code or 'Lumens'
  reserves: Array<Types.Reserve>, // non-empty only if native currency
}

type State = {
  expanded: boolean,
}

export default class Asset extends React.Component<Props, State> {
  state = {expanded: false}

  _toggleExpanded = () => {
    this.setState(prevProps => ({
      expanded: !prevProps.expanded,
    }))
  }

  render() {
    return (
      <Box2 direction="vertical" fullWidth={true}>
        <ClickableBox onClick={this._toggleExpanded}>
          <Box2 direction="horizontal" fullWidth={true} style={styles.headerContainer}>
            <Box2 direction="horizontal" gap="tiny" style={styles.labelContainer}>
              <Icon
                type={this.state.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
                style={iconCastPlatformStyles(styles.caret)}
              />
              <Box2 direction="vertical">
                <Text type="BodySemibold" lineClamp={1}>
                  {this.props.name}
                </Text>
                <Text type="BodySmall" lineClamp={1}>
                  {this.props.issuerName}
                </Text>
              </Box2>
            </Box2>
            <Box2 direction="vertical" style={styles.balanceContainer} fullHeight={true}>
              <Text
                type="BodyExtrabold"
                lineClamp={1}
                style={{color: globalColors.purple2}}
              >
                {this.props.balance} {this.props.code}
              </Text>
              <Text
                type="BodySmall"
                lineClamp={1}
              >
                {this.props.equivBalance}
              </Text>
            </Box2>
          </Box2>
        </ClickableBox>
        {this.state.expanded && (
          <Box2 direction="horizontal" fullWidth={true} style={styles.expandedRowContainer}>
            {this.props.code === 'XLM' && (
              <BalanceSummary
                availableToSend={this.props.availableToSend}
                equivAvailableToSend={this.props.equivAvailableToSend}
                reserves={this.props.reserves}
                total={this.props.balance}
              />
            )}
            {!!this.props.issuerAccountID && <IssuerAccountID issuerAccountID={this.props.issuerAccountID} />}
          </Box2>
        )}
      </Box2>
    )
  }
}

type BalanceSummaryProps = {
  availableToSend: string,
  equivAvailableToSend: string,
  reserves: Array<Types.Reserve>,
  total: string,
}

const BalanceSummary = (props: BalanceSummaryProps) => {
  const _openStellarURL = () => {
    if (!isMobile) return
    openURL('https://www.stellar.org/faq/#_Why_is_there_a_minimum_balance')
  }

  return (
    <Box2 direction="vertical" fullWidth={true} style={styles.balanceSummaryContainer}>
      <Divider style={{marginBottom: globalMargins.tiny}} />
      <Box2 direction="horizontal" fullWidth={true}>
        <Text type="BodySemibold" style={styles.leftColText}>
          Total
        </Text>
        <Text type="BodyExtrabold" selectable={true}>
          {props.total}
        </Text>
      </Box2>
      {props.reserves.map(reserve => (
        <Box2 direction="horizontal" fullWidth={true} key={reserve.description}>
          <Box2 direction="horizontal" style={styles.leftColText}>
            <Text type="Body" lineClamp={1}>
              Reserve ({reserve.description})
            </Text>
            {reserve.description === 'account' && (
              <WithTooltip
                text="Minimum balances help protect the network from the creation of spam accounts."
                multiline={true}
              >
                <Icon
                  fontSize={isMobile ? 18 : 12}
                  onClick={_openStellarURL}
                  style={styles.questionMark}
                  type="iconfont-question-mark" />
              </WithTooltip>
            )}
          </Box2>
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
          <Text type="BodySmall" selectable={true}>
            {props.equivAvailableToSend}
          </Text>
        </Box2>
      </Box2>
    </Box2>
  )
}

type IssuerAccountIDProps = {
  issuerAccountID: string,
}

const IssuerAccountID = (props: IssuerAccountIDProps) => (
  <Box2 direction="vertical" fullWidth={true} style={styles.balanceSummaryContainer}>
    <Text type="Body">Issuer:</Text>
    <Text type="Body" selectable={true}>
      {props.issuerAccountID}
    </Text>
  </Box2>
)

const styles = styleSheetCreate({
  balanceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  balanceSummaryContainer: {
    flexBasis: 355,
    flexShrink: 1,
  },
  caret: platformStyles({
    isElectron: {lineHeight: '2'},
    isMobile: {marginTop: 6},
  }),
  expandedRowContainer: {
    justifyContent: 'flex-end',
    paddingBottom: globalMargins.tiny,
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.small,
  },
  headerContainer: {
    height: 48,
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small,
  },
  labelContainer: {
    flex: 1,
  },
  leftColText: {
    flex: 1,
  },
  questionMark: platformStyles({
    common: {
      marginLeft: 4,
    },
    isElectron: {
      cursor: 'pointer',
    },
  }),
})
