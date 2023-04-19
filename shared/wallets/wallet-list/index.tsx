import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type {AccountID} from '../../constants/types/wallets'
import AddAccount from '../nav-header/add-account'
import WalletRow from './wallet-row/container'

type AddProps = {
  onAddNew: () => void
  onLinkExisting: () => void
}

const rowHeight = 48

const AddWallet = (props: AddProps) => {
  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      items={[
        {icon: 'iconfont-new', onClick: () => props.onAddNew(), title: 'Create a new account'},
        {
          icon: 'iconfont-identity-stellar',
          onClick: () => props.onLinkExisting(),
          title: 'Link an existing Stellar account',
        },
      ]}
      onHidden={toggleShowingPopup}
      visible={showingPopup}
      position="bottom center"
    />
  ))

  return (
    <Kb.ClickableBox onClick={toggleShowingPopup} ref={popupAnchor}>
      <Kb.Box2
        style={styles.addContainerBox}
        direction="horizontal"
        fullWidth={true}
        className="hover_background_color_blueGreyDark"
      >
        <Kb.Icon type="icon-wallet-placeholder-add-32" style={styles.icon} />
        <Kb.Text type="BodySemibold">Add an account</Kb.Text>
      </Kb.Box2>
      {popup}
    </Kb.ClickableBox>
  )
}

const WhatIsStellar = (props: {onWhatIsStellar: () => void}) => (
  <Kb.ClickableBox onClick={props.onWhatIsStellar} style={styles.whatIsStellar}>
    <Kb.Box2 centerChildren={true} direction="horizontal">
      <Kb.Icon sizeType="Small" type="iconfont-info" />
      <Kb.Text style={styles.infoText} type="BodySmallSemibold">
        What is Stellar?
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

export type Props = {
  accountIDs: Array<AccountID>
  style?: Styles.StylesCrossPlatform
  loading: boolean
  onAddNew: () => void
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

    return (
      <>
        {this.props.loading && <Kb.ProgressIndicator style={styles.progressHeader} />}
        <Kb.BoxGrow>
          <Kb.List items={rows} renderItem={this._renderRow} keyProperty="key" style={this.props.style} />
        </Kb.BoxGrow>
        <Kb.Box2 direction="vertical" gap={Styles.isMobile ? 'tiny' : 'xtiny'} style={styles.addAccount}>
          <AddAccount />
        </Kb.Box2>
        <WhatIsStellar onWhatIsStellar={this.props.onWhatIsStellar} />
      </>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addAccount: Styles.platformStyles({
        isElectron: {
          backgroundColor: Styles.globalColors.blueGrey,
          flexShrink: 0,
          padding: Styles.globalMargins.xsmall,
          width: '100%',
        },
        isMobile: {
          ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
          backgroundColor: Styles.globalColors.fastBlank,
          flexShrink: 0,
          width: '100%',
        },
        isTablet: {backgroundColor: Styles.globalColors.transparent},
      }),
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
    } as const)
)

export {WalletList}
