import WalletRow from './wallet-row/container'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type {Props} from '.'

export const WalletSwitcher = (props: Props) => {
  const onWhatIsStellar = () => {
    props.hideMenu()
    props.onWhatIsStellar()
  }
  const header = (
    <Kb.ClickableBox onClick={onWhatIsStellar}>
      <Kb.Box2 centerChildren={true} direction="horizontal" style={styles.infoTextRowContainer}>
        <Kb.Icon type="iconfont-info" />
        <Kb.Text style={styles.infoText} type="BodySemibold">
          What is Stellar?
        </Kb.Text>
      </Kb.Box2>
    </Kb.ClickableBox>
  )

  const items: Kb.MenuItems = []
  items.push(
    {
      icon: 'iconfont-new',
      onClick: props.onAddNew,
      title: 'Create a new account',
    },
    {
      icon: 'iconfont-identity-stellar',
      onClick: props.onLinkExisting,
      title: 'Link an existing Stellar account',
    },
    'Divider'
  )
  props.accountIDs.forEach(accountID => {
    items.push({
      title: `Account ${accountID}`,
      view: <WalletRow accountID={accountID} hideMenu={props.hideMenu} />,
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

const styles = Styles.styleSheetCreate(() => ({
  icon: {
    height: 20,
    position: 'relative',
    right: 2,
    width: 20,
  },
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
}))
