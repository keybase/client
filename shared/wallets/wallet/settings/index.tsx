import * as React from 'react'
import * as Constants from '../../../constants/wallets'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/wallets'
import {AccountPageHeader} from '../../common'
import DisplayCurrencyDropdown from './display-currency-dropdown'
import {IconType} from '../../../common-adapters/icon.constants-gen'
import WalletSettingTrustline from './trustline/container'
import openUrl from '../../../util/open-url'

export type SettingsProps = {
  accountID: Types.AccountID
  name: string
  user: string
  isDefault: boolean
  currencyWaiting: boolean
  currency: Types.Currency
  currencies: Array<Types.Currency>
  canSubmitTx: boolean
  externalPartners: Array<Types.PartnerUrl & {showDivider: boolean}>
  mobileOnlyMode: boolean
  mobileOnlyEditable: boolean
  mobileOnlyWaiting: boolean
  onBack: () => void
  onDelete: () => void
  onLoadSecretKey?: () => void
  onSecretKeySeen?: () => void
  onSetDefault: () => void
  onEditName: () => void
  onCurrencyChange: (currency: Types.CurrencyCode) => void
  onMobileOnlyModeChange: (enabled: boolean) => void
  refresh: () => void
  saveCurrencyWaiting: boolean
  secretKey: string
  showExternalPartners: boolean
  thisDeviceIsLockedOut: boolean
}

const Divider = () => <Kb.Divider style={styles.divider} />

type PartnerRowProps = {
  extra: string
  description: string
  iconFilename: IconType
  title: string
  url: string
}
const PartnerRow = (props: PartnerRowProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
    <Kb.Icon
      type={props.iconFilename}
      colorOverride={Styles.globalColors.black}
      fontSize={32}
      style={styles.partnerIcon}
    />
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.yesShrink}>
      <Kb.ClickableBox
        className="hover-underline-container"
        onClick={() => openUrl(props.url)}
        style={styles.partnerLinkContainer}
      >
        <Kb.Text className="hover-underline-child" style={styles.partnerLink} type="BodyPrimaryLink">
          {props.title}
        </Kb.Text>
        <Kb.Icon fontSize={Styles.isMobile ? 16 : 12} style={styles.openIcon} type="iconfont-open-browser" />
      </Kb.ClickableBox>
      <Kb.Text type="BodySmall">{props.description}</Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" style={styles.noShrink} />
  </Kb.Box2>
)

const ConnectedHeader = () => {
  const name = Container.useSelector(state => {
    const accountID = Constants.getSelectedAccount(state)
    return Constants.getAccount(state, accountID).name
  })

  return <AccountPageHeader accountName={name} title="Settings" />
}

class AccountSettings extends React.Component<SettingsProps> {
  static navigationOptions = {
    header: undefined,
    headerTitle: () => <ConnectedHeader />,
  }

  componentDidMount() {
    this.props.refresh()
  }
  componentWillUnmount() {
    this.clearKey()
  }

  private clearKey = () => {
    this.props.onSecretKeySeen && this.props.onSecretKeySeen()
  }

  render() {
    const props = this.props
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        {Styles.isMobile && <Kb.NavigationEvents onWillBlur={this.clearKey} />}
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
                  <Kb.Text
                    className="hover_color_blackOrBlack hover_background_color_yellowLight"
                    type="BodySemibold"
                  >
                    {props.name}
                  </Kb.Text>
                  <Kb.Icon style={styles.icon} type="iconfont-edit" fontSize={Styles.isMobile ? 22 : 16} />
                </Kb.Box2>
              </Kb.Box2>
            </Kb.ClickableBox>
            <Divider />
            <Kb.Box2 direction="vertical" style={styles.section} fullWidth={true} gap="tiny">
              <Kb.Text type="BodySmallSemibold">Stellar address</Kb.Text>
              <Kb.CopyText text={props.accountID} containerStyle={styles.copyTextContainer} />
            </Kb.Box2>
            <Divider />
            <Kb.Box2 direction="vertical" gap="tiny" style={styles.section} fullWidth={true}>
              <Kb.Text type="BodySmallSemibold">Secret key</Kb.Text>
              {!props.thisDeviceIsLockedOut ? (
                <>
                  <Kb.Banner color="yellow" inline={true}>
                    Only paste your secret key in 100% safe places. Anyone with this key could steal your
                    Stellar&nbsp;account.
                  </Kb.Banner>
                  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.secretKeyContainer}>
                    <Kb.CopyText
                      containerStyle={styles.copyTextContainer}
                      multiline={true}
                      withReveal={true}
                      loadText={() => this.props.onLoadSecretKey && this.props.onLoadSecretKey()}
                      hideOnCopy={true}
                      onCopy={this.clearKey}
                      text={this.props.secretKey}
                      placeholderText="fetching and decrypting secret key..."
                    />
                  </Kb.Box2>
                </>
              ) : (
                <Kb.Text type="Body">
                  You can only view your secret key on mobile devices because this is a mobile-only account.
                </Kb.Text>
              )}
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
                  <Kb.Text style={styles.externalPartnersText} type="BodySmall">
                    Note: Partners listed here are not affiliated with Keybase and are listed for convenience
                    only. If you choose to visit a partner, that partner will see your Keybase username and
                    Stellar address.
                  </Kb.Text>
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
                        iconFilename={partner.iconFilename as IconType}
                        title={partner.title}
                        url={partner.url}
                      />
                    </Kb.Box2>
                  ))}
                </Kb.Box2>
                <Divider />
              </Kb.Box>
            )}

            <WalletSettingTrustline accountID={props.accountID} />

            <Kb.Box2
              direction="vertical"
              noShrink={true}
              gap="small"
              gapEnd={true}
              fullWidth={true}
              style={styles.removeContainer}
            >
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
                  onClick={props.isDefault ? undefined : props.onDelete}
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      alignSelfFlexStart: {alignSelf: 'flex-start'},
      copyTextContainer: {
        alignSelf: 'flex-start',
        maxWidth: '100%',
      },
      deleteOpacity: {opacity: 0.3},
      divider: {
        marginBottom: Styles.globalMargins.tiny,
        marginTop: Styles.globalMargins.tiny,
      },
      externalPartnersText: {
        marginBottom: Styles.globalMargins.tiny,
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
      openIcon: Styles.platformStyles({
        common: {
          left: Styles.globalMargins.xtiny,
          position: 'relative',
        },
        isElectron: {
          top: Styles.globalMargins.xtiny,
        },
      }),
      partnerDivider: {
        marginBottom: Styles.globalMargins.tiny,
        marginLeft: 40,
        marginTop: Styles.globalMargins.tiny,
      },
      partnerIcon: {flexShrink: 0, height: 32, width: 32},
      partnerLink: {color: Styles.globalColors.black},
      partnerLinkContainer: {
        ...Styles.globalStyles.flexBoxRow,
        alignSelf: 'flex-start',
      },
      progressContainer: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.fillAbsolute,
          alignItems: 'center',
          backgroundColor: Styles.globalColors.white_90,
          display: 'flex',
          justifyContent: 'center',
        },
      }),
      progressIndicator: Styles.platformStyles({
        isElectron: {
          height: 17,
          width: 17,
        },
        isMobile: {
          height: 22,
          width: 22,
        },
      }),
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
      secretKeyContainer: {
        marginTop: Styles.globalMargins.tiny,
        position: 'relative',
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
      yesShrink: {flexShrink: 1},
    } as const)
)

export default AccountSettings
