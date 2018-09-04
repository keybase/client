// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/wallets'

export type SettingsProps = {
  accountID: Types.AccountID,
  name: string,
  user: string,
  isDefault: boolean,
  currency: Types.Currency,
  currencies: I.List<Types.Currency>,
  onBack: () => void,
  onDelete: () => void,
  onSetDefault: () => void,
  onEditName: () => void,
  onCurrencyChange: (currency: Types.CurrencyCode) => void,
  refresh: () => void,
}

const makeDropdownItems = (currencies: I.List<Types.Currency>, currency: Types.Currency) => {
  const items = [
    <Kb.Box2 centerChildren={true} direction="vertical" key="_header">
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

const AccountSettings = (props: SettingsProps) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.HeaderHocHeader title="Settings" onBack={props.onBack} headerStyle={styles.header} />
      <Kb.Box2 direction="vertical" style={styles.settingsPage} fullWidth={true}>
        <Kb.Text type="BodySmallSemibold">Account name</Kb.Text>
        <Kb.ClickableBox style={styles.nameBox}>
          <Kb.Text type="BodySemibold">{props.name}</Kb.Text>
          <Kb.Icon
            style={Kb.iconCastPlatformStyles(styles.icon)}
            type="iconfont-edit"
            onClick={props.onEditName}
          />
        </Kb.ClickableBox>
        <Kb.Box2 direction="vertical" style={styles.sectionLabel}>
          <Kb.Text type="BodySmallSemibold">Identity</Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.accountBox}>
          <Kb.Avatar
            size={32}
            style={Kb.avatarCastPlatformStyles(styles.avatar)}
            username={props.isDefault ? props.user : ''}
          />
          <Kb.Box2 direction="vertical">
            <Kb.Text type="Body">
              {props.isDefault ? 'This is your default Keybase account.' : 'This is a secondary account.'}
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
        <Kb.Box2 direction="vertical" style={styles.sectionLabel}>
          <Kb.Text type="BodySmallSemibold">Display currency</Kb.Text>
        </Kb.Box2>
        <Kb.Dropdown
          items={makeDropdownItems(props.currencies, props.currency)}
          selected={makeDropdownItem(props.currency, false)}
          onChanged={(node: React.Node) => {
            // $ForceType doesn't understand key will be string
            const selectedCode: Types.CurrencyCode = node.key
            if (selectedCode !== props.currency.code) {
              props.onCurrencyChange(selectedCode)
            }
          }}
          style={styles.dropdown}
        />
        <Kb.Text type="BodySmall">The display currency appears:</Kb.Text>
        <Kb.Text type="BodySmall">- near your Lumens balance</Kb.Text>
        <Kb.Text type="BodySmall">- when sending or receiving Lumens</Kb.Text>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.removeContainer}>
          <Kb.ClickableBox style={styles.remove} onClick={props.onDelete}>
            <Kb.Icon
              type="iconfont-trash"
              style={Styles.collapseStyles([styles.rightMargin, props.isDefault && styles.deleteOpacity])}
              color={Styles.globalColors.red}
            />
            <Kb.Text
              type="BodySemibold"
              style={Styles.collapseStyles([styles.red, props.isDefault && styles.deleteOpacity])}
              className="hover-underline"
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
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  accountBox: {
    marginBottom: Styles.globalMargins.medium,
  },
  avatar: {
    marginRight: Styles.globalMargins.tiny,
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
    marginBottom: Styles.globalMargins.xsmall,
  },
  itemSelected: {
    color: Styles.globalColors.blue,
  },
  icon: {
    marginLeft: Styles.globalMargins.xtiny,
  },
  nameBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    marginBottom: Styles.globalMargins.medium,
  },
  red: {
    color: Styles.globalColors.red,
  },
  removeContainer: {
    borderColor: Styles.globalColors.black_10,
    borderStyle: 'solid',
    borderTopWidth: 1,
    marginTop: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.small,
  },
  rightMargin: {
    marginRight: Styles.globalMargins.tiny,
  },
  sectionLabel: {
    marginBottom: Styles.globalMargins.tiny,
    alignSelf: 'flex-start',
  },
  settingsPage: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      backgroundColor: Styles.globalColors.white,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isMobile: {
      paddingTop: Styles.globalMargins.xlarge,
    },
  }),
  dropdown: {
    alignItems: 'center',
    marginBottom: Styles.globalMargins.xtiny,
  },
  remove: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default AccountSettings
