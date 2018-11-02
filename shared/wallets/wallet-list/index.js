// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {type AccountID} from '../../constants/types/wallets'
import WalletRow from './wallet-row/container'

type AddProps = {
  onAddNew: () => void,
  onLinkExisting: () => void,
}

const rowHeight = Styles.isMobile ? 56 : 48

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
  acceptedDisclaimer?: boolean,
  accountIDs: Array<AccountID>,
  style?: Styles.StylesCrossPlatform,
  onAddNew: () => void,
  onLinkExisting: () => void,
  onWhatIsStellar: () => void,
  refresh: () => void,
  title: string,
}

type Row = {type: 'wallet', accountID: AccountID} | {type: 'add wallet'} | {type: 'what is stellar'}

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
      case 'what is stellar':
        return <WhatIsStellar key={row.type} onWhatIsStellar={this.props.onWhatIsStellar} />
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

const WalletList = Kb.HeaderOnMobile(_WalletList)

const styles = Styles.styleSheetCreate({
  addContainerBox: {height: rowHeight, alignItems: 'center'},
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
    // bottom: 0,
    height: Styles.globalMargins.large,
    justifyContent: 'center',
    // position: 'absolute',
    width: '100%',
  },
})

export type {Props}
export {WalletList}
