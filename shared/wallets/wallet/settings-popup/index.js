// @flow
import * as React from 'react'
import {
  Avatar,
  Box2,
  ClickableBox,
  Dropdown,
  Icon,
  iconCastPlatformStyles,
  Text,
  avatarCastPlatformStyles,
} from '../../../common-adapters'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  globalStyles,
  platformStyles,
  styleSheetCreate,
} from '../../../styles'

export type Props = {
  name: string,
  user: string,
  isDefault: boolean,
  currency: string,
  currencies: Array<string>,
  onDelete: () => void,
  onSetDefault: () => void,
  onEditName: () => void,
  onCurrencyChange: (currency: string) => void,
}

const makeDropdownItems = (props: Props) => {
  const items = [
    <Box2 centerChildren={true} direction="vertical" key="_header">
      <Text type="BodySmall" style={styles.dropdownHeader}>
        Past transactions won't be affected by this change.
      </Text>
    </Box2>,
  ]
  return items.concat(props.currencies.map(s => makeDropdownItem(s, s === props.currency)))
}

const makeDropdownItem = (item: string, isSelected: boolean) => (
  <Box2 centerChildren={true} direction="vertical" fullWidth={true} key={item}>
    <Text type="BodyBig" style={collapseStyles([styles.centerText, isSelected && styles.itemSelected])}>
      {item}
    </Text>
  </Box2>
)

const SettingsPopup = (props: Props) => {
  return (
    <Box2 direction="vertical" style={styles.settingsPage}>
      <Box2 centerChildren={true} gap="small" gapStart={true} gapEnd={true} direction="vertical">
        <Text type="Header">Settings</Text>
      </Box2>
      <Box2 direction="vertical" style={styles.sectionLabel}>
        <Text type="BodySmallSemibold">Account name</Text>
      </Box2>
      <ClickableBox style={styles.nameBox}>
        <Text type="BodySemibold">{props.name}</Text>
        <Icon style={iconCastPlatformStyles(styles.icon)} type="iconfont-edit" onClick={props.onEditName} />
      </ClickableBox>
      <Box2 direction="vertical" style={styles.sectionLabel}>
        <Text type="BodySmallSemibold">Identity</Text>
      </Box2>
      <Box2 direction="horizontal" fullWidth={true} style={styles.accountBox}>
        <Avatar
          size={32}
          style={avatarCastPlatformStyles(styles.avatar)}
          username={props.isDefault ? props.user : ''}
        />
        <Box2 direction="vertical">
          <Text type="Body">
            {props.isDefault ? 'This is your default Keybase account.' : 'This is a secondary account.'}
          </Text>
          <Text type="BodySmall">
            {props.isDefault
              ? 'All transactions and overall activity are tied to your Keybase identity.'
              : 'Transactions will be tied to your Stellar public address only.'}
          </Text>
          {!props.isDefault && (
            <Text type="BodySmallPrimaryLink" onClick={props.onSetDefault}>
              Set as default Keybase account
            </Text>
          )}
        </Box2>
      </Box2>
      <Box2 direction="vertical" style={styles.sectionLabel}>
        <Text type="BodySmallSemibold">Display currency</Text>
      </Box2>
      <Dropdown
        items={makeDropdownItems(props)}
        selected={makeDropdownItem(props.currency, false)}
        onChanged={(node: React.Node) => {
          // $ForceType doesn't understand key will be string
          const selectedCurrency: string = node.key
          props.onCurrencyChange(selectedCurrency)
        }}
        style={styles.dropdown}
      />
      <Text type="BodySmall">The display currency appears:</Text>
      <Text type="BodySmall">- near your Lumens balance</Text>
      <Text type="BodySmall">- when sending or receiving Lumens</Text>
      <Box2 direction="vertical" fullWidth={true} style={styles.removeContainer}>
        <ClickableBox style={styles.remove} onClick={props.onDelete}>
          <Icon
            type="iconfont-trash"
            style={collapseStyles([styles.rightMargin, props.isDefault && styles.deleteOpacity])}
            color={globalColors.red}
          />
          <Text
            type="BodyBigLink"
            style={collapseStyles([styles.red, props.isDefault && styles.deleteOpacity])}
            className="hover-underline"
          >
            Remove account
          </Text>
        </ClickableBox>
        {props.isDefault && (
          <Text style={styles.centerText} type="BodySmall">
            You can’t remove your default account.
          </Text>
        )}
      </Box2>
    </Box2>
  )
}

const styles = styleSheetCreate({
  accountBox: {
    marginBottom: globalMargins.medium,
  },
  avatar: {
    marginRight: globalMargins.tiny,
  },
  deleteBox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteOpacity: {
    opacity: 0.3,
  },
  dropdownHeader: {
    textAlign: 'center',
    padding: globalMargins.xsmall,
  },
  centerText: {
    textAlign: 'center',
  },
  itemSelected: {
    color: globalColors.blue,
  },
  icon: {
    marginLeft: globalMargins.xtiny,
  },
  nameBox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    marginBottom: globalMargins.medium,
  },
  red: {
    color: globalColors.red,
  },
  removeContainer: {
    borderColor: globalColors.black_10,
    borderStyle: 'solid',
    borderTopWidth: 1,
    marginTop: globalMargins.medium,
    paddingTop: globalMargins.small,
  },
  rightMargin: {
    marginRight: globalMargins.tiny,
  },
  sectionLabel: {
    marginBottom: globalMargins.tiny,
    alignSelf: 'flex-start',
  },
  settingsPage: platformStyles({
    common: {
      backgroundColor: globalColors.white,
      padding: globalMargins.small,
      maxWidth: 560,
    },
    isMobile: {
      paddingTop: globalMargins.xlarge,
    },
    isElectron: {
      marginBottom: 40,
      marginLeft: 80,
      marginRight: 80,
      marginTop: 40,
    },
  }),
  dropdown: {
    alignItems: 'center',
    marginBottom: globalMargins.xtiny,
  },
  remove: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default SettingsPopup
