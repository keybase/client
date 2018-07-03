// @flow
import * as React from 'react'
import {Box2, ClickableBox, Icon, List, Text, FloatingMenu} from '../../common-adapters'
import {styleSheetCreate, globalMargins, globalColors, isMobile, type StylesCrossPlatform} from '../../styles'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../common-adapters/floating-menu'
import {type AccountID} from '../../constants/types/wallets'
import WalletRow from './wallet-row/container'

type AddProps = {
  onAddNew: () => void,
  onLinkExisting: () => void,
}

const rowHeight = isMobile ? 56 : 48

const styles = styleSheetCreate({
  addContainerBox: {height: rowHeight, paddingTop: globalMargins.small},
})

const _AddWallet = (props: AddProps & FloatingMenuParentProps) => {
  const menuItems = [
    {
      onClick: () => props.onAddNew(),
      title: 'Create a new wallet',
    },
    {
      disabled: isMobile,
      onClick: () => props.onLinkExisting(),
      title: 'Link an existing Stellar wallet',
    },
  ]

  return (
    <ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
      <Box2
        style={styles.addContainerBox}
        direction="horizontal"
        fullWidth={true}
        gap="xsmall"
        gapStart={true}
        gapEnd={true}
      >
        <Icon type="iconfont-new" color={globalColors.blue} />
        <Text type="BodyBigLink">Add an account</Text>
      </Box2>
      <FloatingMenu
        attachTo={props.attachmentRef}
        closeOnSelect={true}
        items={menuItems}
        onHidden={props.toggleShowingMenu}
        visible={props.showingMenu}
        position="bottom center"
      />
    </ClickableBox>
  )
}

const AddWallet = FloatingMenuParentHOC(_AddWallet)

type Props = {
  accountIDs: Array<AccountID>,
  style?: StylesCrossPlatform,
  onAddNew: () => void,
  onLinkExisting: () => void,
}

type Row = {type: 'wallet', accountID: AccountID} | {type: 'add wallet'}

class WalletList extends React.Component<Props> {
  _renderRow = (i: number, row: Row): React.Node => {
    switch (row.type) {
      case 'wallet':
        return <WalletRow key={row.accountID} accountID={row.accountID} />
      case 'add wallet':
        return <AddWallet onAddNew={this.props.onAddNew} onLinkExisting={this.props.onLinkExisting} />
      default:
        /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(row.type);
      */
        throw new Error(`Impossible case encountered: ${row.type}`)
    }
  }

  render = () => {
    const rows = this.props.accountIDs.map(accountID => ({type: 'wallet', accountID}))
    rows.push({type: 'add wallet'})

    return <List items={rows} renderItem={this._renderRow} keyProperty="key" style={this.props.style} />
  }
}

export type {Props}
export {WalletList}
