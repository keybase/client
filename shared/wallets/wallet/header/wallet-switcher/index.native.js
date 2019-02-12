// @flow
import * as React from 'react'
import WalletRow from './wallet-row/container'
import * as Types from '../../../../constants/types/wallets'
import * as Kb from '../../../../common-adapters'
import * as Flow from '../../../../util/flow'
import * as Styles from '../../../../styles'
import {TouchableOpacity} from 'react-native'
import {type Props} from '.'

type RowProps = {|
  children: React.Node,
  isLast?: boolean,
  onPress?: () => void,
  containerStyle?: Styles.StylesCrossPlatform,
  style?: Styles.StylesCrossPlatform,
|}

const Row = (props: RowProps) => (
  <Kb.Box2 direction="vertical" style={Styles.collapseStyles([styles.rowContainer, props.containerStyle])}>
    <TouchableOpacity
      onPress={props.onPress}
      style={Styles.collapseStyles([styles.row, props.isLast && styles.lastRow, props.style])}
    >
      {props.children}
    </TouchableOpacity>
  </Kb.Box2>
)

type MenuItem =
  | {|
      key: string,
      onPress: () => void,
      title: string,
      type: 'item',
    |}
  | {|
      key: Types.AccountID,
      accountID: Types.AccountID,
      type: 'wallet',
    |}

const renderItem = (item: MenuItem, isLast: boolean, hideMenu: () => void) => {
  switch (item.type) {
    case 'item': {
      const onPress = () => {
        hideMenu()
        item.onPress()
      }
      return (
        <Row isLast={isLast} key={item.key} onPress={onPress}>
          <Kb.Text center={true} type="BodyBig" style={{color: Styles.globalColors.blue}}>
            {item.title}
          </Kb.Text>
        </Row>
      )
    }
    case 'wallet':
      // No need to pass down onPress.
      return (
        <Row isLast={isLast} key={item.key}>
          <WalletRow accountID={item.accountID} hideMenu={hideMenu} />
        </Row>
      )
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(item.type)
      throw new Error(`Invalid type ${item.type} passed to renderItem`)
  }
}

const bottomPadding = 8
const cancelRowHeight = 48
const infoTextRowHeight = 48
const rowHeight = 56

export const WalletSwitcher = (props: Props) => {
  if (!props.showingMenu) {
    return null
  }

  const menuItems = [
    {
      key: 'newAccount',
      onPress: props.onAddNew,
      title: 'Create a new account',
      type: 'item',
    },
    {
      key: 'linkAccount',
      onPress: props.onLinkExisting,
      title: 'Link an existing Stellar account',
      type: 'item',
    },
    ...props.accountIDs.map(accountID => ({
      accountID,
      key: accountID,
      type: 'wallet',
    })),
  ]

  // Kind of a pain we have to calculate the height manually.
  const dividerHeight = 2 * bottomPadding + 1
  const cancelRowHeightWithPadding = cancelRowHeight + bottomPadding
  const height = infoTextRowHeight + rowHeight * menuItems.length + dividerHeight + cancelRowHeightWithPadding

  const whatOnPress = () => {
    props.hideMenu()
    props.onWhatIsStellar()
  }

  return (
    <Kb.Overlay
      position="bottom center"
      onHidden={props.hideMenu}
      visible={props.showingMenu}
      attachTo={props.getAttachmentRef}
    >
      <Kb.Box2
        direction="vertical"
        style={Styles.collapseStyles([styles.container, {height}])}
        fullWidth={true}
      >
        <Row onPress={whatOnPress} containerStyle={styles.infoTextRowContainer} style={styles.infoTextRow}>
          <Kb.Box2 centerChildren={true} direction="horizontal">
            <Kb.Icon size={16} type="iconfont-info" />
            <Kb.Text style={styles.infoText} type="BodySemibold">
              What is Stellar?
            </Kb.Text>
          </Kb.Box2>
        </Row>
        <Kb.List
          items={menuItems}
          renderItem={(index, item) => renderItem(item, index === menuItems.length - 1, props.hideMenu)}
          bounces={false}
        />
        <Kb.Divider style={styles.divider} />
        <Row onPress={props.hideMenu} style={styles.cancelRow}>
          <Kb.Text center={true} type={'BodyBig'} style={{color: Styles.globalColors.blue}}>
            Cancel
          </Kb.Text>
        </Row>
      </Kb.Box2>
    </Kb.Overlay>
  )
}

const styles = Styles.styleSheetCreate({
  cancelRow: {
    height: cancelRowHeight,
    marginBottom: bottomPadding,
  },
  container: {
    backgroundColor: Styles.globalColors.white,
    justifyContent: 'flex-end',
    // Leave some space for the status bar.
    maxHeight: '95%',
  },
  divider: {
    backgroundColor: Styles.globalColors.black_05,
    marginBottom: bottomPadding,
  },
  infoText: {
    color: Styles.globalColors.black_60,
    fontSize: 14,
    paddingLeft: Styles.globalMargins.tiny,
  },
  infoTextRow: {
    height: infoTextRowHeight,
  },
  infoTextRowContainer: {
    backgroundColor: Styles.globalColors.lightGrey,
  },
  lastRow: {
    // Have this instead of a top margin on the divider to maximize
    // the area of the scrollview.
    marginBottom: bottomPadding,
  },
  row: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    borderColor: Styles.globalColors.black_10,
    height: rowHeight,
    justifyContent: 'center',
  },
  rowContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.white,
    width: '100%',
  },
})
