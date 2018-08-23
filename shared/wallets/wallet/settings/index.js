// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/wallets'

export type SettingsPopupProps = {
  accountID: Types.AccountID,
  name: string,
  user: string,
  isDefault: boolean,
  currency: Types.Currency,
  currencies: I.List<Types.Currency>,
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
      type="Header"
      style={Styles.collapseStyles([styles.centerText, isSelected && styles.itemSelected])}
    >
      {item.description}
    </Kb.Text>
  </Kb.Box2>
)

const WalletSettings = (props: SettingsPopupProps) => {
  return (
    <Kb.Box2 direction="vertical" style={styles.settingsPage}>
      <Kb.Box2 centerChildren={true} direction="vertical">
        <Kb.Text style={styles.smallPadding} type="Header">
          Settings
        </Kb.Text>
      </Kb.Box2>
      <Kb.Text type="BodySmallSemibold">Account name</Kb.Text>
      <Kb.ClickableBox style={styles.nameBox}>
        <Kb.Text type="BodySemibold">{props.name}</Kb.Text>
        <Kb.Icon
          style={Kb.iconCastPlatformStyles(styles.icon)}
          type="iconfont-edit"
          onClick={props.onEditName}
        />
      </Kb.ClickableBox>
      <Kb.Text type="BodySmallSemibold">Identity</Kb.Text>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.accountBox}>
        <Kb.Avatar
          size={32}
          style={Kb.avatarCastPlatformStyles(styles.avatar)}
          username={props.isDefault ? props.user : ''}
        />
        <Kb.Box2 direction="vertical">
          <Kb.Text type="Header">
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
      <Kb.Text type="BodySmallSemibold">Display currency</Kb.Text>
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
  )
}

const styles = Styles.styleSheetCreate({
  accountBox: {
    marginBottom: Styles.globalMargins.medium,
  },
  avatar: {
    marginRight: Styles.globalMargins.xtiny,
  },
  deleteBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
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
  rightMargin: {
    marginRight: Styles.globalMargins.tiny,
  },
  settingsPage: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      padding: Styles.globalMargins.small,
      maxWidth: 560,
    },
    isMobile: {
      paddingTop: Styles.globalMargins.xlarge,
    },
    isElectron: {
      marginBottom: 40,
      marginLeft: 80,
      marginRight: 80,
      marginTop: 40,
    },
  }),
  smallPadding: {
    padding: Styles.globalMargins.small,
  },
  dropdown: {
    alignItems: 'center',
  },
  remove: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Styles.globalMargins.small,
  },
})

export default WalletSettings
