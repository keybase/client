import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {AccountID} from '../../constants/types/wallets'
import WalletRow from './wallet-row/container'
import flags from '../../util/feature-flags'

type AddProps = {
  onAddNew: () => void
  onLinkExisting: () => void
}

const rowHeight = 48

const _AddWallet = (props: AddProps & Kb.OverlayParentProps) => {
  const menuItems = [
    {onClick: () => props.onAddNew(), title: 'Create a new account'},
    {onClick: () => props.onLinkExisting(), title: 'Link an existing Stellar account'},
  ]

  return (
    <Kb.ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
      <Kb.Box2
        style={styles.addContainerBox}
        direction="horizontal"
        fullWidth={true}
        className="hover_background_color_blueGreyDark"
      >
        <Kb.Icon type="icon-wallet-placeholder-add-32" style={Kb.iconCastPlatformStyles(styles.icon)} />
        <Kb.Text type="BodySemibold">Add an account</Kb.Text>
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

const JoinAirdrop = (p: {onJoinAirdrop: (() => void) | null; inAirdrop: boolean; selected: boolean}) => (
  <Kb.ClickableBox onClick={p.onJoinAirdrop || undefined}>
    <Kb.Box2
      style={Styles.collapseStyles([
        styles.joinAirdrop,
        p.selected && {backgroundColor: Styles.globalColors.purpleLight},
      ])}
      direction="horizontal"
      fullWidth={true}
      className="hover_background_color_blueGreyDark"
    >
      <Kb.Icon type="icon-airdrop-logo-32" style={Kb.iconCastPlatformStyles(styles.icon)} />
      <Kb.Text negative={p.selected} type="BodySemibold">
        {p.inAirdrop ? 'Airdrop' : 'Join the airdrop'}
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

const WhatIsStellar = (props: {onWhatIsStellar: () => void}) => (
  <Kb.ClickableBox onClick={props.onWhatIsStellar} style={styles.whatIsStellar}>
    <Kb.Box2 centerChildren={true} direction="horizontal">
      <Kb.Icon sizeType={'Small'} type="iconfont-info" />
      <Kb.Text style={styles.infoText} type="BodySmallSemibold">
        What is Stellar?
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

export type Props = {
  accountIDs: Array<AccountID>
  airdropIsLive: boolean
  airdropSelected: boolean
  style?: Styles.StylesCrossPlatform
  loading: boolean
  inAirdrop: boolean
  onAddNew: () => void
  onJoinAirdrop: (() => void) | null
  onLinkExisting: () => void
  onWhatIsStellar: () => void
  title: string
}

type Row =
  | {
      type: 'wallet'
      accountID: AccountID
      key?: string
    }
  | {
      type: 'add wallet'
      key?: string
    }
  | {
      type: 'join airdrop'
      key?: string
    }

class WalletList extends React.Component<Props> {
  _renderRow = (_: number, row: Row) => {
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
      case 'join airdrop':
        return (
          <JoinAirdrop
            key={row.type}
            onJoinAirdrop={this.props.onJoinAirdrop}
            inAirdrop={this.props.inAirdrop}
            selected={this.props.airdropSelected}
          />
        )
      default:
        throw new Error(`Impossible case encountered: ${row}`)
    }
  }

  render() {
    if (this.props.loading && !this.props.accountIDs.length) {
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
          <Kb.ProgressIndicator style={styles.progressIndicator} />
        </Kb.Box2>
      )
    }

    const rows: Row[] = this.props.accountIDs.map(
      accountID => ({accountID, key: accountID, type: 'wallet'} as const)
    )

    if (flags.airdrop && this.props.airdropIsLive) {
      const joinAirdrop = 'join airdrop'
      rows.push({key: joinAirdrop, type: joinAirdrop})
    }

    return (
      <>
        {this.props.loading && <Kb.ProgressIndicator style={styles.progressHeader} />}
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
  joinAirdrop: {
    alignItems: 'center',
    height: rowHeight,
  },
  progressHeader: {
    height: 18,
    left: 40,
    position: 'absolute',
    top: 9,
    width: 18,
    zIndex: 2,
  },
  progressIndicator: {height: 30, width: 30},
  whatIsStellar: {
    height: Styles.globalMargins.large,
    justifyContent: 'center',
    width: '100%',
  },
})

export {WalletList}
