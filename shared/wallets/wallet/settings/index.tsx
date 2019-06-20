import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/wallets'
import {AccountPageHeader} from '../../common'
import DisplayCurrencyDropdown from './display-currency-dropdown'
import openUrl from '../../../util/open-url'

export type SettingsProps = {
  accountID: Types.AccountID
  name: string
  user: string
  inflationDestination: string
  isDefault: boolean
  currencyWaiting: boolean
  currency: Types.Currency
  currencies: I.List<Types.Currency>
  canSubmitTx: boolean
  externalPartners: Array<Types.PartnerUrl & {showDivider: boolean}>
  mobileOnlyMode: boolean
  mobileOnlyEditable: boolean
  mobileOnlyWaiting: boolean
  onBack: () => void
  onDelete: () => void
  onSetDefault: () => void
  onEditName: () => void
  onSetupInflation: () => void
  onCurrencyChange: (currency: Types.CurrencyCode) => void
  onMobileOnlyModeChange: (enabled: boolean) => void
  refresh: () => void
  saveCurrencyWaiting: boolean
  showExternalPartners: boolean
  thisDeviceIsLockedOut: boolean
}

const HoverText = Styles.isMobile
  ? Kb.Text
  : Styles.styled(Kb.Text)({
      ':hover': {backgroundColor: Styles.globalColors.yellowLight},
    })

const Divider = () => <Kb.Divider style={styles.divider} />

type PartnerRowProps = {
  extra: string
  description: string
  iconFilename: string
  title: string
  url: string
}
const PartnerRow = (props: PartnerRowProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
    <Kb.Icon type="icon-stellar-logo-grey-32" style={styles.partnerIcon} />
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.yesShrink}>
      <Kb.Text onClickURL={props.url} style={styles.partnerLink} type="BodyPrimaryLink">
        {props.title}
      </Kb.Text>
      <Kb.Text type="BodySmall">{props.description}</Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" style={styles.noShrink}>
      <Kb.Icon
        onClick={() => openUrl(props.url)}
        fontSize={Styles.isMobile ? 16 : 12}
        type="iconfont-open-browser"
      />
    </Kb.Box2>
  </Kb.Box2>
)

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
              <Kb.Text type="BodySmallSemibold" style={styles.identity}>
                Identity
              </Kb.Text>
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
                  {!props.isDefault &&
                    (props.thisDeviceIsLockedOut ? (
                      <Kb.Text style={styles.setAsDefaultError} type="BodySmall">
                        This account can only be made default from a mobile device over 7 days old.
                      </Kb.Text>
                    ) : (
                      <Kb.Text type="BodySmallPrimaryLink" onClick={props.onSetDefault}>
                        Set as default Keybase account
                      </Kb.Text>
                    ))}
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
            {!!props.showExternalPartners && props.externalPartners.length > 0 && (
              <Kb.Box>
                <Kb.Box2
                  direction="vertical"
                  style={styles.section}
                  fullWidth={true}
                  gap="tiny"
                  gapEnd={true}
                >
                  <Kb.Text type="BodySmallSemibold">External tools and partners</Kb.Text>
                  {props.externalPartners.map(partner => (
                    <Kb.Box2
                      key={partner.url}
                      direction="vertical"
                      style={{width: Styles.isMobile ? undefined : '100%'}}
                    >
                      {partner.showDivider && <Kb.Divider style={styles.partnerDivider} />}
                      <PartnerRow
                        description={partner.description}
                        extra={partner.extra}
                        iconFilename={partner.iconFilename}
                        title={partner.title}
                        url={partner.url}
                      />
                    </Kb.Box2>
                  ))}
                </Kb.Box2>
                <Divider />
              </Kb.Box>
            )}

            <Kb.Box2 direction="vertical" gap="tiny" style={styles.section} fullWidth={true}>
              <Kb.Box2 direction="horizontal" style={styles.alignSelfFlexStart} gap="xtiny" fullWidth={true}>
                <Kb.Text type="BodySmallSemibold">Inflation destination</Kb.Text>
                {!Styles.isMobile && (
                  <Kb.WithTooltip
                    text="Every year, the total Lumens grows by 1% due to inflation, and you can cast a vote for who gets it."
                    multiline={true}
                  >
                    <Kb.Icon type="iconfont-question-mark" sizeType="Small" />
                  </Kb.WithTooltip>
                )}
              </Kb.Box2>
              {!!props.inflationDestination && (
                <Kb.Text type="BodySemibold" selectable={true}>
                  {props.inflationDestination}
                </Kb.Text>
              )}
              {!!props.canSubmitTx && (
                <Kb.Button
                  mode="Secondary"
                  label={props.inflationDestination ? 'Change' : 'Set up'}
                  onClick={props.onSetupInflation}
                  style={styles.setupInflation}
                />
              )}
              {!props.canSubmitTx && (
                <Kb.Text type="BodySmall">
                  Your account needs more funds to set an inflation destination.
                </Kb.Text>
              )}
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
              <Kb.Box2
                direction="vertical"
                fullWidth={true}
                centerChildren={true}
                gap="tiny"
                style={styles.removeContentContainer}
              >
                {!props.isDefault && props.thisDeviceIsLockedOut && (
                  <Kb.Text type="BodySmall">
                    This account can only be removed from a mobile device over 7 days old.
                  </Kb.Text>
                )}
                <Kb.Button
                  disabled={props.isDefault || props.thisDeviceIsLockedOut}
                  label="Remove account"
                  fullWidth={true}
                  type="Danger"
                  onClick={props.isDefault ? null : props.onDelete}
                />
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
    ...(!Styles.isMobile ? {minHeight: 48} : {}),
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid',
  },
  icon: {marginLeft: Styles.globalMargins.xtiny},
  identity: {
    paddingBottom: Styles.globalMargins.tiny,
  },
  identityBox: {
    flexGrow: 1,
    flexShrink: 1,
  },
  mobileOnlySpinner: {
    backgroundColor: Styles.globalColors.white_90,
  },
  noShrink: {flexShrink: 0},
  partnerDivider: {
    marginBottom: Styles.globalMargins.tiny,
    marginLeft: 40,
    marginTop: Styles.globalMargins.tiny,
  },
  partnerIcon: {flexShrink: 0, height: 32, width: 32},
  partnerLink: {color: Styles.globalColors.black},
  red: {color: Styles.globalColors.redDark},
  remove: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeContainer: Styles.platformStyles({
    isElectron: {marginTop: 'auto'},
    isMobile: {marginTop: Styles.globalMargins.medium},
  }),
  removeContentContainer: {...Styles.padding(0, Styles.globalMargins.small)},
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
  setAsDefaultError: {
    paddingTop: Styles.globalMargins.tiny,
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
  yesShrink: {flexShrink: 1},
})

export default AccountSettings
