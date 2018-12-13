// @flow
import * as React from 'react'
import WalletRow from './wallet-row/container'
import * as Types from '../../../../constants/types/wallets'
import * as Kb from '../../../../common-adapters'
import * as Flow from '../../../../util/flow'
import * as Styles from '../../../../styles'
import {TouchableOpacity} from 'react-native'
import {type Props} from './container'

const Row = (props: RowProps) => (
  <Kb.Box2 direction="vertical" style={Styles.collapseStyles([styles.rowContainer, props.style])}>
    <TouchableOpacity
      onPress={() => {
        props.hideMenu() // auto hide after a selection
        props.onClick()
      }}
      style={styles.row}
    >
      {props.children}
    </TouchableOpacity>
  </Kb.Box2>
)

type MenuItem =
  | {|
      key: 'whatIsStellar',
      onClick: () => void,
      type: 'whatIsStellar',
    |}
  | {|
      key: string,
      onClick: () => void,
      title: string,
      type: 'item',
    |}
  | {|
      key: Types.AccountID,
      accountID: Types.AccountID,
      type: 'wallet',
    |}

type RowProps = {|
  children: React.Node,
  onClick: () => void,
  hideMenu: () => void,
  style?: Styles.StylesCrossPlatform,
|}

const renderItem = (item: MenuItem, hideMenu: () => void) => {
  switch (item.type) {
    case 'whatIsStellar':
      return (
        <Row key={item.key} onClick={item.onClick} hideMenu={hideMenu} style={styles.infoTextRow}>
          <Kb.Box2 centerChildren={true} direction="horizontal">
            <Kb.Icon size={16} type="iconfont-info" />
            <Kb.Text style={styles.infoText} type="BodySemibold">
              What is Stellar?
            </Kb.Text>
          </Kb.Box2>
        </Row>
      )
    case 'item':
      return (
        <Row key={item.key} onClick={item.onClick} hideMenu={hideMenu}>
          <Kb.Text type={'BodyBig'} style={{color: Styles.globalColors.blue, textAlign: 'center'}}>
            {item.title}
          </Kb.Text>
        </Row>
      )
    case 'wallet':
      return (
        <Row key={item.key} onClick={() => {}} hideMenu={hideMenu}>
          <WalletRow accountID={item.accountID} onSelect={hideMenu} />
        </Row>
      )
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(item.type)
      throw new Error(`Invalid type ${item.type} passed to renderItem`)
  }
}

const styles = Styles.styleSheetCreate({
  infoText: {
    paddingLeft: Styles.globalMargins.tiny,
  },
  infoTextRow: {
    backgroundColor: Styles.globalColors.lightGrey,
  },
  row: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    borderColor: Styles.globalColors.black_10,
    height: 48,
    justifyContent: 'center',
  },
  rowContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.white,
    width: '100%',
  },
})

// TODO: Replace with a real list, but figure out how to make it
// bottom-aligned instead of top-aligned.
const FakeList = ({items, renderItem}) => {
  const children = items.map((item, index) => renderItem(index, item))
  return <React.Fragment>{children}</React.Fragment>
}

export const WalletSwitcher = (props: Props) => {
  if (!props.showingMenu) {
    return null
  }

  const menuItems = [
    {
      key: 'whatIsStellar',
      onClick: props.onWhatIsStellar,
      type: 'whatIsStellar',
    },
    {
      key: 'newAccount',
      onClick: props.onAddNew,
      title: 'Create a new account',
      type: 'item',
    },
    {
      key: 'linkAccount',
      onClick: props.onLinkExisting,
      title: 'Link an existing Stellar account',
      type: 'item',
    },
  ]
    .concat(
      props.accountIDs.map(accountID => ({
        accountID,
        key: accountID,
        type: 'wallet',
      }))
    )
    .concat([
      {
        key: 'cancel',
        onClick: () => {},
        title: 'Cancel',
        type: 'item',
      },
    ])

  return (
    <Kb.Overlay
      position="bottom center"
      onHidden={props.hideMenu}
      visible={props.showingMenu}
      attachTo={props.getAttachmentRef}
    >
      <FakeList items={menuItems} renderItem={(index, item) => renderItem(item, props.hideMenu)} />
    </Kb.Overlay>
  )
}
