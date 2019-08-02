import * as React from 'react'
import WalletRow from './wallet-row/container'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import flags from '../../../../util/feature-flags'
import {Props} from '.'

export const WalletSwitcher = (props: Props) => {
  const onWhatIsStellar = () => {
    props.hideMenu()
    props.onWhatIsStellar()
  }
  const header: Kb.MenuItem = {
    onClick: props.onWhatIsStellar,
    title: 'What is Stellar?',
    view: (
      <Kb.ClickableBox onClick={onWhatIsStellar}>
        <Kb.Box2 centerChildren={true} direction="horizontal" style={styles.infoTextRowContainer}>
          <Kb.Icon type="iconfont-info" />
          <Kb.Text style={styles.infoText} type="BodySemibold">
            What is Stellar?
          </Kb.Text>
        </Kb.Box2>
      </Kb.ClickableBox>
    ),
  }
  let items: Array<Kb.MenuItem> = []
  if (flags.airdrop && props.airdropIsLive) {
    items.push({
      onClick: props.onJoinAirdrop,
      title: props.inAirdrop ? 'Airdrop' : 'Join the airdrop',
      view: (
        <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny">
          <Kb.Icon type="icon-airdrop-logo-32" />
          <Kb.Text center={true} type="BodyBig" style={{color: Styles.globalColors.blueDark}}>
            {props.inAirdrop ? 'Airdrop' : 'Join the airdrop'}
          </Kb.Text>
        </Kb.Box2>
      ),
    })
  }
  items.push(
    {
      onClick: props.onAddNew,
      title: 'Create a new account',
    },
    {
      onClick: props.onLinkExisting,
      title: 'Link an existing Stellar account',
    }
  )
  props.accountIDs.forEach(accountID => {
    items.push({
      title: `Account ${accountID}`,
      view: <WalletRow accountID={accountID} hideMenu={() => {}} />,
    })
  })

  return (
    <Kb.FloatingMenu
      closeOnSelect={true}
      attachTo={props.getAttachmentRef}
      header={header}
      items={items}
      onHidden={props.hideMenu}
      position="bottom right"
      visible={props.showingMenu}
    />
  )
}

const styles = Styles.styleSheetCreate({
  infoText: {
    color: Styles.globalColors.black_50,
    paddingLeft: Styles.globalMargins.tiny,
  },
  infoTextRowContainer: {
    backgroundColor: Styles.globalColors.greyLight,
    paddingBottom: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
    width: '100%',
  },
})
