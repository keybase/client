// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/wallets'
import {AccountPageHeader} from '../../common'

export type SettingsProps = {|
  accountID: Types.AccountID,
  name: string,
  user: string,
  isDefault: boolean,
  currencyWaiting: boolean,
  currency: Types.Currency,
  currencies: I.List<Types.Currency>,
  onBack: () => void,
  onDelete: () => void,
  onSetDefault: () => void,
  onEditName: () => void,
  onCurrencyChange: (currency: Types.CurrencyCode) => void,
  refresh: () => void,
|}

const headerKey = '_header'

const makeDropdownItems = (currencies: I.List<Types.Currency>, currency: Types.Currency) => {
  const items = [
    <Kb.Box2 centerChildren={true} direction="vertical" key={headerKey}>
      <Kb.Text type="BodySmall" style={styles.dropdownHeader}>
        Past transactions won't be affected by this change.
      </Kb.Text>
    </Kb.Box2>,
  ]
  // spread the List into an array with [...]
  return items.concat([...currencies].map(s => makeDropdownItem(s, s.code === currency.code)))
}

const makeDropdownItem = (item: Types.Currency, isSelected: boolean) => (
  <Kb.Box2 centerChildren={true} direction="vertical" fullWidth={true} key={item.code}>
    <Kb.Text
      type="BodyBig"
      style={Styles.collapseStyles([styles.centerText, isSelected && styles.itemSelected])}
    >
      {item.description}
    </Kb.Text>
  </Kb.Box2>
)

const HoverText = Styles.isMobile
  ? Kb.Text
  : Styles.glamorous(Kb.Text)({
      ':hover': {
        backgroundColor: Styles.globalColors.yellow3,
      },
    })

const AccountSettings = (props: SettingsProps) => {
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
          fullHeight={!Styles.isMobile}
        >
          <Kb.ClickableBox onClick={props.onEditName}>
            <Kb.Box2
              direction="vertical"
              gap="xtiny"
              style={Styles.collapseStyles([styles.sidePaddings, {marginBottom: Styles.globalMargins.small}])}
              fullWidth={true}
            >
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
          {Styles.isMobile && <Kb.Divider style={{marginBottom: Styles.globalMargins.tiny}} />}
          <Kb.Box2
            direction="vertical"
            style={Styles.collapseStyles([styles.sidePaddings, {marginBottom: Styles.globalMargins.small}])}
            fullWidth={true}
            gap="tiny"
          >
            <Kb.Text type="BodySmallSemibold">Stellar address</Kb.Text>
            <Kb.CopyText text={props.accountID} containerStyle={styles.accountIDContainer} />
          </Kb.Box2>
          {Styles.isMobile && <Kb.Divider style={{marginBottom: Styles.globalMargins.tiny}} />}
          <Kb.Box2 direction="vertical" style={styles.sidePaddings} fullWidth={true}>
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.sectionLabel}>
              <Kb.Text type="BodySmallSemibold">Identity</Kb.Text>
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.accountBox}>
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
                  {props.isDefault ? 'This is your default payment account.' : 'This is a secondary account.'}
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
          {Styles.isMobile && <Kb.Divider style={{marginBottom: Styles.globalMargins.tiny}} />}
          <Kb.Box2
            direction="vertical"
            style={Styles.collapseStyles([styles.sidePaddings, {marginBottom: Styles.globalMargins.small}])}
          >
            <Kb.Box2 direction="vertical" style={styles.sectionLabel}>
              <Kb.Text type="BodySmallSemibold">Display currency</Kb.Text>
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.dropdownContainer} gap="tiny">
              <Kb.Dropdown
                disabled={props.currencyWaiting}
                items={makeDropdownItems(props.currencies, props.currency)}
                selected={makeDropdownItem(props.currency, false)}
                onChanged={(node: React.Node) => {
                  // $ForceType doesn't understand key will be string
                  const selectedCode: Types.CurrencyCode = node.key
                  if (selectedCode !== props.currency.code && selectedCode !== headerKey) {
                    props.onCurrencyChange(selectedCode)
                  }
                }}
                style={styles.dropdown}
              />
              {!Styles.isMobile && (
                <Kb.SaveIndicator
                  saving={props.currencyWaiting}
                  minSavingTimeMs={300}
                  savedTimeoutMs={2500}
                />
              )}
            </Kb.Box2>
            <Kb.Text type="BodySmall">The display currency appears:</Kb.Text>
            <Kb.Text type="BodySmall">- near your Lumens balance</Kb.Text>
            <Kb.Text type="BodySmall">- when sending or receiving Lumens</Kb.Text>
          </Kb.Box2>
          {Styles.isMobile && <Kb.Divider style={{marginBottom: Styles.globalMargins.tiny}} />}
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.removeContainer}>
            <Kb.ClickableBox style={styles.remove} onClick={props.isDefault ? null : props.onDelete}>
              <Kb.Icon
                type="iconfont-trash"
                style={Styles.collapseStyles([styles.rightMargin, props.isDefault && styles.deleteOpacity])}
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
              <Kb.Text style={styles.centerText} type="BodySmall">
                You can’t remove your default account.
              </Kb.Text>
            )}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  identityBox: {
    flexGrow: 1,
    flexShrink: 1,
  },
  accountBox: {
    marginBottom: Styles.globalMargins.medium,
  },
  accountIDContainer: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  deleteOpacity: {
    opacity: 0.3,
  },
  dropdownHeader: {
    textAlign: 'center',
    padding: Styles.globalMargins.xsmall,
  },
  centerText: {
    textAlign: 'center',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: Styles.globalColors.black_10,
    borderStyle: 'solid',
    marginBottom: Styles.isMobile ? 0 : Styles.globalMargins.xsmall,
  },
  itemSelected: {
    color: Styles.globalColors.blue,
  },
  icon: {
    marginLeft: Styles.globalMargins.xtiny,
  },
  red: {
    color: Styles.globalColors.red,
  },
  removeContainer: Styles.platformStyles({
    isElectron: {
      marginTop: 'auto',
    },
    isMobile: {
      marginTop: Styles.globalMargins.medium,
    },
  }),
  rightMargin: {
    marginRight: Styles.globalMargins.tiny,
  },
  sectionLabel: {
    marginBottom: Styles.globalMargins.tiny,
    alignSelf: 'flex-start',
  },
  settingsPage: {
    alignSelf: 'flex-start',
    backgroundColor: Styles.globalColors.white,
    paddingTop: Styles.isMobile ? Styles.globalMargins.small : 0,
    paddingBottom: Styles.globalMargins.small,
  },
  sidePaddings: {
    alignSelf: 'flex-start',
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  dropdownContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  dropdown: {
    alignItems: 'center',
    marginBottom: Styles.globalMargins.xtiny,
    flexShrink: 1,
  },
  remove: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    display: 'flex',
    flexGrow: 1,
    width: '100%',
  },
})

export default AccountSettings
