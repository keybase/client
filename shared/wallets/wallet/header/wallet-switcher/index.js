// @flow
import * as React from 'react'
import {TouchableOpacity} from 'react-native'
import * as Kb from '../../../../common-adapters'
import * as Types from '../../../../constants/types/wallets'
import * as Styles from '../../../../styles'
import WalletRow from '../../../wallet-list/wallet-row/container'

type MenuItem = {|
  onClick?: ?(evt?: SyntheticEvent<>) => void,
  title: string,
  view?: React.Node,
|}

const renderItem = (item: MenuItem, onHidden: () => void) => (
  <TouchableOpacity
    onPress={() => {
      onHidden && onHidden() // auto hide after a selection
      item.onClick && item.onClick()
    }}
    style={styles.row}
  >
    {item.view || (
      <Kb.Text type={'BodyBig'} style={{color: Styles.globalColors.blue, textAlign: 'center'}}>
        {item.title}
      </Kb.Text>
    )}
  </TouchableOpacity>
)

const styles = Styles.styleSheetCreate({
  infoText: {
    paddingLeft: Styles.globalMargins.tiny,
    position: 'relative',
    top: -1,
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
})

export type Props = {
  accountIDs: Array<Types.AccountID>,
  onAddNew: () => void,
  onLinkExisting: () => void,
  onWhatIsStellar: () => void,
  walletName: string,
}

const Menu = (props: Props & Kb.OverlayParentProps) => {
  if (!props.showingMenu) {
    return null
  }

  const menuItems = [
    {
      onClick: props.onWhatIsStellar,
      title: 'What is Stellar?',
      view: (
        <Kb.Box2 centerChildren={true} direction="horizontal">
          <Kb.Icon size={16} type="iconfont-info" />
          <Kb.Text style={styles.infoText} type="BodySemibold">
            What is Stellar?
          </Kb.Text>
        </Kb.Box2>
      ),
    },
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
        title: 'Cancel',
        view: renderItem(
          {
            onClick: props.toggleShowingMenu,
            title: 'Cancel',
          },
          // pass in nothing to onHidden so it doesn't trigger it twice
          () => {}
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
      <Kb.List
        items={menuItems}
        keyProperty="title"
        renderItem={(index, item) => renderItem(item, props.toggleShowingMenu)}
      />
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
