import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  availableToSend: string // non-empty only if native currency
  balance: string
  code: string // The same as `name` except for XLM
  depositButtonText?: string // SEP6 link
  depositButtonWaitingKey?: string // SEP6 waiting key
  equivAvailableToSend: string // non-empty only if native currency e.g. '$123.45 USD'
  equivBalance: string // non-empty only if native currency
  expanded?: boolean // for testing
  infoUrlText: string
  isNative: boolean
  issuerName: string // verified issuer domain name, 'Stellar network' or 'Unknown'
  issuerAccountID: string // issuing public key
  name: string // Asset code or 'Lumens'
  onDeposit?: () => void
  onWithdraw?: () => void
  openInfoURL?: () => void
  openStellarURL: () => void
  reserves: Array<Types.Reserve> // non-empty only if native currency
  withdrawButtonText?: string // SEP6 link
  withdrawButtonWaitingKey?: string // SEP6 waiting key
}

type State = {
  expanded: boolean
}

export default class Asset extends React.Component<Props, State> {
  state = {expanded: !!this.props.expanded}

  _toggleExpanded = () => {
    this.setState(prevProps => ({
      expanded: !prevProps.expanded,
    }))
  }

  _openInfoURL = (e: React.BaseSyntheticEvent) => {
    e.stopPropagation()
    this.props.openInfoURL && this.props.openInfoURL()
  }

  _onDeposit = (e: React.BaseSyntheticEvent) => {
    e.stopPropagation()
    this.props.onDeposit && this.props.onDeposit()
  }

  _onWithdraw = (e: React.BaseSyntheticEvent) => {
    e.stopPropagation()
    this.props.onWithdraw && this.props.onWithdraw()
  }
  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.ClickableBox onClick={this._toggleExpanded}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.headerContainer}>
            <Kb.Box2 direction="horizontal" gap="tiny" style={styles.labelContainer}>
              <Kb.Icon
                type={this.state.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
                sizeType="Tiny"
                style={Kb.iconCastPlatformStyles(styles.caret)}
              />
              <Kb.Box2 direction="vertical">
                <Kb.Text type="BodySemibold" lineClamp={1}>
                  {this.props.name}
                </Kb.Text>
                <Kb.Text type="BodySmall" lineClamp={1}>
                  {this.props.issuerName}
                </Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
            <Kb.Box2 direction="vertical" style={styles.balanceContainer} fullHeight={true}>
              <Kb.Text type="BodyExtrabold" lineClamp={1} style={styles.balance}>
                {this.props.balance} {this.props.code}
              </Kb.Text>
              {!!this.props.equivBalance && (
                <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.equivContainer}>
                  <Kb.Text type="BodySmallSecondaryLink">{this.props.equivBalance}</Kb.Text>
                </Kb.Box2>
              )}
            </Kb.Box2>
          </Kb.Box2>
        </Kb.ClickableBox>
        {this.state.expanded && (
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.expandedRowContainer}>
            {this.props.isNative && (
              <BalanceSummary
                availableToSend={this.props.availableToSend}
                equivAvailableToSend={this.props.equivAvailableToSend}
                reserves={this.props.reserves}
                total={this.props.balance}
                openStellarURL={this.props.openStellarURL}
              />
            )}
            <Kb.Box2 direction="vertical" fullWidth={true}>
              {!!this.props.issuerAccountID && (
                <IssuerAccountID issuerAccountID={this.props.issuerAccountID} />
              )}
              <Kb.Box2 direction="horizontal" fullWidth={true}>
                <Kb.ButtonBar direction="row" align="flex-start" small={true}>
                  {!!this.props.depositButtonText && (
                    <Kb.WaitingButton
                      mode="Secondary"
                      label={this.props.depositButtonText}
                      onClick={this.props.onDeposit}
                      small={true}
                      type="Wallet"
                      waitingKey={this.props.depositButtonWaitingKey || null}
                    />
                  )}

                  {!!this.props.withdrawButtonText && (
                    <Kb.WaitingButton
                      mode="Secondary"
                      label={this.props.withdrawButtonText}
                      onClick={this.props.onWithdraw}
                      small={true}
                      type="Wallet"
                      waitingKey={this.props.withdrawButtonWaitingKey || null}
                    />
                  )}
                  {!!this.props.infoUrlText && (
                    <Kb.Button
                      mode="Secondary"
                      label={this.props.infoUrlText}
                      onClick={this.props.openInfoURL}
                      small={true}
                      type="Wallet"
                    />
                  )}
                </Kb.ButtonBar>
              </Kb.Box2>
            </Kb.Box2>
          </Kb.Box2>
        )}
      </Kb.Box2>
    )
  }
}

type BalanceSummaryProps = {
  availableToSend: string
  equivAvailableToSend: string
  reserves: Array<Types.Reserve>
  total: string
  openStellarURL: () => void
}

const BalanceSummary = (props: BalanceSummaryProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.balanceSummaryContainer}>
    <Kb.Divider style={styles.dividerTop} />
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.Text type="BodySemibold" style={styles.leftColText}>
        Total
      </Kb.Text>
      <Kb.Text type="BodyExtrabold" selectable={true}>
        {props.total} XLM
      </Kb.Text>
    </Kb.Box2>
    {props.reserves.map(reserve => (
      <Kb.Box2 direction="horizontal" fullWidth={true} key={reserve.description}>
        <Kb.Box2 direction="horizontal" style={styles.leftColText}>
          <Kb.Text type="Body" lineClamp={1}>
            Reserve ({reserve.description})
          </Kb.Text>
          {reserve.description === 'account' && (
            <Kb.WithTooltip
              text="Minimum balances help protect the network from the creation of spam accounts."
              multiline={true}
            >
              <Kb.Icon
                onClick={Styles.isMobile ? props.openStellarURL : null}
                sizeType="Small"
                style={styles.questionMark}
                type="iconfont-question-mark"
              />
            </Kb.WithTooltip>
          )}
        </Kb.Box2>
        <Kb.Text type="Body" lineClamp={1} selectable={true}>
          -{reserve.amount} XLM
        </Kb.Text>
      </Kb.Box2>
    ))}
    <Kb.Divider style={styles.divider} />
    <Kb.Box2 direction="horizontal" fullWidth={true} style={{alignItems: 'flex-start'}}>
      <Kb.Text type="BodySemibold" style={styles.leftColText}>
        Available to send
      </Kb.Text>
      <Kb.Box2 direction="vertical" style={styles.balanceContainer}>
        <Kb.Text type="Body" selectable={true} style={{fontWeight: '800'}}>
          {props.availableToSend} XLM
        </Kb.Text>
        <Kb.Text type="BodySmall" selectable={true}>
          {props.equivAvailableToSend}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Box2>
)

type IssuerAccountIDProps = {
  issuerAccountID: string
}

const IssuerAccountID = (props: IssuerAccountIDProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Text type="BodySmall">Issuer:</Kb.Text>
    <Kb.Text type="BodySmall" selectable={true} lineClamp={3}>
      {props.issuerAccountID}
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  balance: {color: Styles.globalColors.purpleDark},
  balanceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  balanceSummaryContainer: Styles.platformStyles({
    common: {
      flexShrink: 1,
    },
    isElectron: {
      alignSelf: 'flex-end',
      width: 355,
    },
  }),
  caret: Styles.platformStyles({
    isElectron: {lineHeight: '2'},
    isMobile: {marginTop: 6},
  }),
  divider: {
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
  dividerTop: {marginBottom: Styles.globalMargins.tiny},
  equivContainer: {
    justifyContent: 'flex-end',
  },
  equivDivider: {
    paddingLeft: Styles.globalMargins.xtiny,
    paddingRight: Styles.globalMargins.xtiny,
  },
  expandedRowContainer: {
    justifyContent: 'flex-end',
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.small,
  },
  headerContainer: {
    height: Styles.isMobile ? 56 : 48,
    padding: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.small,
  },
  labelContainer: {
    flex: 1,
  },
  leftColText: {
    alignItems: 'center',
    flex: 1,
  },
  questionMark: Styles.platformStyles({
    common: {
      marginLeft: 4,
    },
    isElectron: {
      cursor: 'pointer',
    },
  }),
})
