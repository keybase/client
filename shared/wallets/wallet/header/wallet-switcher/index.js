// @flow
import * as React from 'react'
import {TouchableOpacity} from 'react-native'
import * as Kb from '../../../../common-adapters'
import * as Types from '../../../../constants/types/wallets'
import * as Styles from '../../../../styles'
import WalletRow from '../../../wallet-list/wallet-row/container'

export type MenuItem = {|
  danger?: boolean,
  disabled?: boolean,
  onClick?: ?(evt?: SyntheticEvent<>) => void,
  onPress?: void,
  style?: Object,
  subTitle?: string, // subTitle is not used on native
  title: string, // Only used as ID if view is provided for Header
  view?: React.Node, // Required for header
|}

type MenuRowProps = {
  ...MenuItem,
  isHeader?: boolean,
  index: number,
  numItems: number,
  onHidden?: ?() => void,
}

const MenuRow = (props: MenuRowProps) => (
  <TouchableOpacity
    disabled={props.disabled}
    onPress={() => {
      props.onHidden && props.onHidden() // auto hide after a selection
      props.onClick && props.onClick()
    }}
    style={styles.row}
  >
    {props.view || (
      <Kb.Text type={'BodyBig'} style={styleRowText(props)}>
        {props.title}
      </Kb.Text>
    )}
  </TouchableOpacity>
)

export type MenuItems = Array<MenuItem>

export type MenuLayoutProps = {
  items: MenuItems,
  onHidden: () => void,
}

class MenuLayout extends React.Component<MenuLayoutProps> {
  render() {
    return (
      <Kb.List
        items={this.props.items}
        renderItem={(index, item) => (
          <MenuRow
            key={item.title}
            {...item}
            index={index}
            numItems={this.props.items.length}
            onHidden={this.props.onHidden}
          />
        )}
      />
    )
  }
}

const styleRowText = (props: {isHeader?: boolean, danger?: boolean, disabled?: boolean}) => {
  const dangerColor = props.danger ? Styles.globalColors.red : Styles.globalColors.blue
  const color = props.isHeader ? Styles.globalColors.white : dangerColor
  return {color, ...(props.disabled ? {opacity: 0.6} : {}), textAlign: 'center'}
}

const styles = Styles.styleSheetCreate({
  closeGroup: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    borderColor: Styles.globalColors.black_10,
    borderTopWidth: 1,
    justifyContent: 'flex-end',
  },
  menuBox: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.white,
    justifyContent: 'flex-end',
  },
  menuGroup: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
  },
  row: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_10,
    height: 56,
    justifyContent: 'center',
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
  },
  safeArea: {
    backgroundColor: Styles.globalColors.white,
  },
})

export type Props = {
  accountIDs: Array<Types.AccountID>,
  onAddNew: () => void,
  onLinkExisting: () => void,
  walletName: string,
}

const Menu = (props: Props & Kb.OverlayParentProps) => {
  if (!props.showingMenu) {
    return null
  }

  const menuItems = [
    {
      onClick: props.onAddNew,
      title: 'Create a new account',
    },
    {
      onClick: props.onLinkExisting,
      title: 'Link an existing Stellar account',
    },
  ]
    .concat(
      props.accountIDs.map(accountID => ({
        title: accountID,
        view: <WalletRow accountID={accountID} onSelect={props.toggleShowingMenu} />,
      }))
    )
    .concat([
      {
        title: 'Close',
        view: (
          <Kb.Box style={styles.closeGroup}>
            <MenuRow
              title="Close"
              index={0}
              numItems={1}
              onClick={props.toggleShowingMenu}
              // pass in nothing to onHidden so it doesn't trigger it twice
              onHidden={() => {}}
            />
          </Kb.Box>
        ),
      },
    ])

  return (
    <Kb.Overlay
      position="bottom center"
      onHidden={props.toggleShowingMenu}
      visible={props.showingMenu}
      attachTo={props.getAttachmentRef}
    >
      <MenuLayout onHidden={props.toggleShowingMenu} items={menuItems} />
    </Kb.Overlay>
  )
}

const _WalletSwitcher = (props: Props & Kb.OverlayParentProps) => (
  <Kb.ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
    <Kb.Text type="BodyBig">{props.walletName}</Kb.Text>
    <Menu {...props} />
  </Kb.ClickableBox>
)

export const WalletSwitcher = Kb.OverlayParentHOC(_WalletSwitcher)
