// @flow
import * as React from 'react'
import {
  Avatar,
  Box2,
  ClickableBox,
  Dropdown,
  HeaderOnMobile,
  Icon,
  MaybePopup,
  Text,
} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles, platformStyles, styleSheetCreate} from '../../../styles'

export type Props = {
  name: string,
  user: string,
  type: 'default' | 'secondary',
  currency: string,
  currencies: Array<string>,
  onDelete: () => void,
  onSetDefault: () => void,
  onEditName: () => void,
  onCurrencyChange: (currency: string) => void,
}

const makeDropdownItems = (props: Props) => {
  let items = [
    <Box2 centerChildren={true} direction="vertical" key="">
      <Text type="BodySmall" style={{textAlign: 'center', padding: globalMargins.xsmall}}>
        Past transactions won’t be affected by this change.
      </Text>
    </Box2>,
  ]
  for (const s of props.currencies) {
    items.push(makeDropdownItem(s, s === props.currency))
  }
  return items
}

const makeDropdownItem = (item: string, isSelected: boolean) => {
  const itemStyle = {
    color: isSelected ? globalColors.blue : null,
    textAlign: 'center',
  }

  return (
    <Box2 centerChildren={true} direction="vertical" fullWidth={true} key={item}>
      <Text type="Header" style={itemStyle}>
        {item}
      </Text>
    </Box2>
  )
}

const SettingsPopup = (props: Props) => {
  const deleteOpacity = props.type === 'default' ? 0.3 : 1
  return (
    <MaybePopup onClose={() => {}}>
      <Box2 direction="vertical" style={styles.padding}>
        <Box2 centerChildren={true} direction="vertical">
          <Text style={{padding: globalMargins.small}} type="Header">
            Settings
          </Text>
        </Box2>
        <Text type="BodySmallSemibold">Account name</Text>
        <ClickableBox style={styles.nameBox}>
          <Text type="BodySemibold">{props.name}</Text>
          <Icon style={{marginLeft: globalMargins.xtiny}} type="iconfont-edit" onClick={props.onEditName} />
        </ClickableBox>
        <Text type="BodySmallSemibold">Identity</Text>
        <Box2 direction="horizontal" fullWidth={true} style={{marginBottom: globalMargins.medium}}>
          <Avatar size={32} style={styles.avatar} username={props.type === 'default' ? props.user : ''} />
          <Box2 direction="vertical">
            <Text type="Header">
              {props.type === 'default'
                ? 'This is your default Keybase account.'
                : 'This is a secondary account.'}
            </Text>
            <Text type="BodySmall">
              {props.type === 'default'
                ? 'All transactions and overall activity are tied to your Keybase identity.'
                : 'Transactions will be tied to your Stellar public address only.'}
            </Text>
            {props.type === 'secondary' && (
              <Text type="BodySmallPrimaryLink" onClick={props.onSetDefault}>
                Set as default Keybase account
              </Text>
            )}
          </Box2>
        </Box2>
        <Text type="BodySmallSemibold">Display currency</Text>
        <Dropdown
          items={makeDropdownItems(props)}
          selected={makeDropdownItem(props.currency, false)}
          onChanged={(node: React.Node) => {
            // $FlowIssue doesn't understand key will be string
            const selectedCurrency: string = (node && node.key) || null
            props.onCurrencyChange(selectedCurrency)
          }}
          style={styles.dropdown}
        />
        <ClickableBox style={styles.remove} onClick={props.onDelete}>
          <Icon
            type="iconfont-trash"
            style={{marginRight: globalMargins.tiny, opacity: deleteOpacity}}
            color={globalColors.red}
          />
          <Text
            type="BodySemibold"
            style={{color: globalColors.red, opacity: deleteOpacity}}
            className="hover-underline"
          >
            Remove account
          </Text>
        </ClickableBox>
        {props.type === 'default' && (
          <Text style={{textAlign: 'center'}} type="BodySmall">
            You can’t remove your default account.
          </Text>
        )}
      </Box2>
    </MaybePopup>
  )
}

const styles = styleSheetCreate({
  avatar: {marginRight: globalMargins.xtiny},
  nameBox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    marginBottom: globalMargins.medium,
  },
  padding: platformStyles({
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
    marginBottom: globalMargins.small,
    alignItems: 'center',
  },
  remove: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default HeaderOnMobile(SettingsPopup)
