// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/wallets'
import {AccountPageHeader} from '../../common'
import DisplayCurrencyDropdown from './display-currency-dropdown'

export type SettingsProps = {|
  accountID: Types.AccountID,
  name: string,
  user: string,
  inflationDestination: string,
  isDefault: boolean,
  currencyWaiting: boolean,
  currency: Types.Currency,
  currencies: I.List<Types.Currency>,
  onBack: () => void,
  onDelete: () => void,
  onSetDefault: () => void,
  onEditName: () => void,
  onSetupInflation: () => void,
  onCurrencyChange: (currency: Types.CurrencyCode) => void,
  onMobileOnlyModeChange: (enabled: boolean) => void,
  refresh: () => void,
  saveCurrencyWaiting: boolean,
  mobileOnlyMode: boolean,
  mobileOnlyWaiting: boolean,
  mobileOnlyEditable: boolean,
|}

const HoverText = Styles.isMobile
  ? Kb.Text
  : Styles.styled(Kb.Text)({
      ':hover': {backgroundColor: Styles.globalColors.yellow3},
    })

const Divider = () => <Kb.Divider style={styles.divider} />

class AccountSettings extends React.Component<SettingsProps> {
  componentDidMount() {
    this.props.refresh()
  }
  render() {
    const props = this.props
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.HeaderHocHeader
          customComponent={<AccountPageHeader accountName={props.name} title="Settings" />}
          onBack={props.onBack}
          headerStyle={styles.header}
        />
        <Kb.ScrollView style={styles.scrollView} contentContainerStyle={{flexGrow: 1}}>
          <Kb.Box2
            direction="vertical"
            style={styles.settingsPage}
            fullWidth={true}
            gap="tiny"
            fullHeight={!Styles.isMobile}
          >
            <Kb.ClickableBox onClick={props.onEditName} style={styles.noShrink}>
              <Kb.Box2 direction="vertical" gap="xtiny" style={styles.section} fullWidth={true}>
                <Kb.Text type="BodySmallSemibold">Account name</Kb.Text>
                <Kb.Box2 direction="horizontal" fullWidth={true}>
                  <HoverText type="BodySemibold">{props.name}</HoverText>
                  <Kb.Icon
                    style={Kb.iconCastPlatformStyles(styles.icon)}
                    type="iconfont-edit"
                    fontSize={Styles.isMobile ? 22 : 16}
                  />
                </Kb.Box2>
              </Kb.Box2>
            </Kb.ClickableBox>
            <Divider />
            <Kb.Box2 direction="vertical" style={styles.section} fullWidth={true} gap="tiny">
              <Kb.Text type="BodySmallSemibold">Stellar address</Kb.Text>
              <Kb.CopyText text={props.accountID} containerStyle={styles.accountIDContainer} />
            </Kb.Box2>
            <Divider />
            <Kb.Box2 direction="vertical" style={styles.section} fullWidth={true}>
              <Kb.Text type="BodySmallSemibold">Identity</Kb.Text>
              <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
                {props.isDefault ? (
                  <Kb.Avatar size={Styles.isMobile ? 48 : 32} username={props.user} />
                ) : (
                  <Kb.Icon
                    type={
                      Styles.isMobile ? 'icon-placeholder-secret-user-48' : 'icon-placeholder-secret-user-32'
                    }
                    style={{height: Styles.isMobile ? 48 : 32, width: Styles.isMobile ? 48 : 32}}
                  />
                )}
                <Kb.Box2 direction="vertical" style={styles.identityBox}>
                  <Kb.Text type="Body">
                    {props.isDefault
                      ? 'This is your default payment account.'
                      : 'This is a secondary account.'}
                  </Kb.Text>
                  <Kb.Text type="BodySmall">
                    {props.isDefault
                      ? 'All transactions and overall activity are tied to your Keybase identity.'
                      : 'Transactions will be tied to your Stellar public address only.'}
                  </Kb.Text>
                  {!props.isDefault && (
                    <Kb.Text type="BodySmallPrimaryLink" onClick={props.onSetDefault}>
                      Set as default Keybase account
                    </Kb.Text>
                  )}
                </Kb.Box2>
              </Kb.Box2>
            </Kb.Box2>
            <Divider />
            <Kb.Box2 direction="vertical" gap="tiny" style={styles.section} fullWidth={true}>
              <Kb.Text type="BodySmallSemibold">Display currency</Kb.Text>
              <DisplayCurrencyDropdown
                currencies={props.currencies}
                selected={props.currency}
                onCurrencyChange={props.onCurrencyChange}
                saveCurrencyWaiting={props.saveCurrencyWaiting}
                waiting={props.currencyWaiting}
              />
              <Kb.Box2 direction="vertical" fullWidth={true}>
                <Kb.Text type="BodySmall">The display currency appears:</Kb.Text>
                <Kb.Text type="BodySmall">- near your Lumens balance</Kb.Text>
                <Kb.Text type="BodySmall">- when sending or receiving Lumens</Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
            <Divider />
            <Kb.Box2 direction="vertical" gap="tiny" style={styles.section} fullWidth={true}>
              <Kb.Box>
                <Kb.Checkbox
                  checked={props.mobileOnlyMode}
                  disabled={!props.mobileOnlyEditable || props.mobileOnlyWaiting}
                  label="Mobile only"
                  onCheck={props.onMobileOnlyModeChange}
                />
                {props.mobileOnlyWaiting && (
                  <Kb.Box2
                    direction="horizontal"
                    centerChildren={true}
                    style={Styles.collapseStyles([
                      Styles.globalStyles.fillAbsolute,
                      styles.mobileOnlySpinner,
                    ])}
                  >
                    <Kb.ProgressIndicator type="Small" />
                  </Kb.Box2>
                )}
              </Kb.Box>
              {!props.mobileOnlyEditable && (
                <Kb.Text type="BodySmall">
                  This setting can only be changed from a mobile device over 7 days old.
                </Kb.Text>
              )}
              {props.mobileOnlyEditable && (
                <Kb.Text type="BodySmall">
                  Prevents sending from this account, when on a desktop or laptop.
                </Kb.Text>
              )}
            </Kb.Box2>
            <Divider />
            <Kb.Box2 direction="vertical" gap="tiny" style={styles.section} fullWidth={true}>
              <Kb.Box2 direction="horizontal" style={styles.alignSelfFlexStart} gap="tiny" fullWidth={true}>
                <Kb.Text type="BodySmallSemibold">Inflation destination</Kb.Text>
                {!Styles.isMobile && (
                  <Kb.WithTooltip
                    text="Every year, the total Lumens grows by 1% due to inflation, and you can cast a vote for who gets it."
                    multiline={true}
                  >
                    <Kb.Icon type="iconfont-question-mark" />
                  </Kb.WithTooltip>
                )}
              </Kb.Box2>
              {!!props.inflationDestination && (
                <Kb.Text type="BodySemibold" selectable={true}>
                  {props.inflationDestination}
                </Kb.Text>
              )}
              <Kb.Button
                type="Secondary"
                label={props.inflationDestination ? 'Change' : 'Set up'}
                onClick={props.onSetupInflation}
                style={styles.setupInflation}
              />
            </Kb.Box2>
            <Kb.Box2
              direction="vertical"
              noShrink={true}
              gap="small"
              gapEnd={true}
              fullWidth={true}
              style={styles.removeContainer}
            >
              <Kb.Divider />
              <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
                <Kb.ClickableBox style={styles.remove} onClick={props.isDefault ? null : props.onDelete}>
                  <Kb.Icon
                    type="iconfont-trash"
                    style={Styles.collapseStyles([
                      styles.rightMargin,
                      props.isDefault && styles.deleteOpacity,
                    ])}
                    color={Styles.globalColors.red}
                  />
                  <Kb.Text
                    type="BodySemibold"
                    style={Styles.collapseStyles([styles.red, props.isDefault && styles.deleteOpacity])}
                    className={Styles.classNames({'hover-underline': !props.isDefault})}
                  >
                    Remove account
                  </Kb.Text>
                </Kb.ClickableBox>
                {props.isDefault && (
                  <Kb.Text center={true} type="BodySmall">
                    You can’t remove your default account.
                  </Kb.Text>
                )}
              </Kb.Box2>
            </Kb.Box2>
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  accountIDContainer: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  alignSelfFlexStart: {alignSelf: 'flex-start'},
  deleteOpacity: {opacity: 0.3},
  divider: {
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
  header: {
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid',
  },
  icon: {marginLeft: Styles.globalMargins.xtiny},
  identityBox: {
    flexGrow: 1,
    flexShrink: 1,
  },
  mobileOnlySpinner: {
    backgroundColor: Styles.globalColors.white_90,
  },
  noShrink: {flexShrink: 0},
  red: {color: Styles.globalColors.red},
  remove: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeContainer: Styles.platformStyles({
    isElectron: {marginTop: 'auto'},
    isMobile: {marginTop: Styles.globalMargins.medium},
  }),
  rightMargin: {
    marginRight: Styles.globalMargins.tiny,
  },
  scrollView: {
    display: 'flex',
    flexGrow: 1,
    paddingTop: Styles.isMobile ? 0 : Styles.globalMargins.xsmall,
    width: '100%',
  },
  section: {
    alignItems: 'flex-start',
    flexShrink: 0,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    marginBottom: Styles.globalMargins.tiny,
  },
  settingsPage: {
    alignSelf: 'flex-start',
    backgroundColor: Styles.globalColors.white,
    flexShrink: 0,
    paddingTop: Styles.isMobile ? Styles.globalMargins.small : 0,
  },
  setupInflation: {
    alignSelf: 'flex-start',
  },
})

export default AccountSettings
