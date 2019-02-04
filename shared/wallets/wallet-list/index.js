// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Flow from '../../util/flow'
import {type AccountID} from '../../constants/types/wallets'
import WalletRow from './wallet-row/container'

type AddProps = {
  onAddNew: () => void,
  onLinkExisting: () => void,
}

const rowHeight = 48

const _AddWallet = (props: AddProps & Kb.OverlayParentProps) => {
  const menuItems = [
    {
      onClick: () => props.onAddNew(),
      title: 'Create a new account',
    },
    {
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
        <Kb.Text type="BodySemibold" style={{color: Styles.globalColors.purple}}>
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

const WhatIsStellar = (props: {onWhatIsStellar: () => void}) => (
  <Kb.ClickableBox onClick={props.onWhatIsStellar} style={styles.whatIsStellar}>
    <Kb.Box2 centerChildren={true} direction="horizontal">
      <Kb.Icon size={16} type="iconfont-info" />
      <Kb.Text style={styles.infoText} type="BodySemibold">
        What is Stellar?
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

type Props = {
  accountIDs: Array<AccountID>,
  style?: Styles.StylesCrossPlatform,
  loading: boolean,
  onAddNew: () => void,
  onLinkExisting: () => void,
  onWhatIsStellar: () => void,
  title: string,
}

type Row = {type: 'wallet', accountID: AccountID} | {type: 'add wallet'}

class WalletList extends React.Component<Props> {
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
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(row.type)
        throw new Error(`Impossible case encountered: ${row.type}`)
    }
  }

  render() {
    if (this.props.loading) {
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
          <Kb.ProgressIndicator style={styles.progressIndicator} />
        </Kb.Box2>
      )
    }
    const rows = this.props.accountIDs.map(accountID => ({accountID, key: accountID, type: 'wallet'}))
    const addWallet = 'add wallet'
    rows.push({key: addWallet, type: addWallet})

    return (
      <>
        <Kb.BoxGrow>
          <Kb.List items={rows} renderItem={this._renderRow} keyProperty="key" style={this.props.style} />
        </Kb.BoxGrow>
        <WhatIsStellar onWhatIsStellar={this.props.onWhatIsStellar} />
      </>
    )
  }
}

const styles = Styles.styleSheetCreate({
  addContainerBox: {alignItems: 'center', height: rowHeight},
  icon: {
    height: Styles.globalMargins.mediumLarge,
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
    width: Styles.globalMargins.mediumLarge,
  },
  infoText: {
    paddingLeft: Styles.globalMargins.tiny,
    position: 'relative',
    top: -1,
  },
  progressIndicator: {height: 30, width: 30},
  whatIsStellar: {
    backgroundColor: Styles.globalColors.blue5,
    height: Styles.globalMargins.large,
    justifyContent: 'center',
    width: '100%',
  },
})

export type {Props}
export {WalletList}
