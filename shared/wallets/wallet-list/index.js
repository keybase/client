// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import {styleSheetCreate, globalColors, globalMargins, isMobile, type StylesCrossPlatform} from '../../styles'
import {type AccountID} from '../../constants/types/wallets'
import WalletRow from './wallet-row/container'

type AddProps = {
  onAddNew: () => void,
  onLinkExisting: () => void,
}

const rowHeight = isMobile ? 56 : 48

const _AddWallet = (props: AddProps & Kb.OverlayParentProps) => {
  const menuItems = [
    {
      onClick: () => props.onAddNew(),
      title: 'Create a new account',
    },
    {
      disabled: isMobile,
      onClick: () => props.onLinkExisting(),
      title: 'Link an existing Stellar account',
    },
  ]

  return (
    <Kb.ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
      <Kb.Box2
        style={styles.addContainerBox}
        direction="horizontal"
        fullWidth={true}
        className="hover_background_color_blueGrey2"
      >
        <Kb.Icon type="icon-wallet-placeholder-add-32" style={Kb.iconCastPlatformStyles(styles.icon)} />
        <Kb.Text type="BodySemibold" style={{color: globalColors.purple}}>
          Add an account
        </Kb.Text>
      </Kb.Box2>
      <Kb.FloatingMenu
        attachTo={props.getAttachmentRef}
        closeOnSelect={true}
        items={menuItems}
        onHidden={props.toggleShowingMenu}
        visible={props.showingMenu}
        position="bottom center"
      />
    </Kb.ClickableBox>
  )
}

const AddWallet = Kb.OverlayParentHOC(_AddWallet)

type Props = {
  accountIDs: Array<AccountID>,
  style?: StylesCrossPlatform,
  onAddNew: () => void,
  onLinkExisting: () => void,
  refresh: () => void,
  title: string,
}

type Row = {type: 'wallet', accountID: AccountID} | {type: 'add wallet'}

class _WalletList extends React.Component<Props> {
  componentDidMount() {
    this.props.refresh()
  }

  _renderRow = (i: number, row: Row): React.Node => {
    switch (row.type) {
      case 'wallet':
        return <WalletRow key={row.accountID} accountID={row.accountID} />
      case 'add wallet':
        return (
          <AddWallet
            key={row.type}
            onAddNew={this.props.onAddNew}
            onLinkExisting={this.props.onLinkExisting}
          />
        )
      default:
        /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(row.type);
      */
        throw new Error(`Impossible case encountered: ${row.type}`)
    }
  }

  render = () => {
    if (this.props.accountIDs.length === 0) {
      // loading
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
          <Kb.ProgressIndicator style={styles.progressIndicator} />
        </Kb.Box2>
      )
    }
    const rows = this.props.accountIDs.map(accountID => ({type: 'wallet', accountID, key: accountID}))
    rows.push({type: 'add wallet', key: 'add wallet'})

    return <Kb.List items={rows} renderItem={this._renderRow} keyProperty="key" style={this.props.style} />
  }
}

const WalletList = Kb.HeaderOnMobile(_WalletList)

const styles = styleSheetCreate({
  icon: {
    marginLeft: globalMargins.tiny,
    marginRight: globalMargins.tiny,
    width: 32,
    height: 32,
  },
  addContainerBox: {height: rowHeight, alignItems: 'center'},
  progressIndicator: {height: 30, width: 30},
})

export type {Props}
export {WalletList}
