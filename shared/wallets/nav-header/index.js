// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/wallets'
import {SmallAccountID, SendButton, DropdownButton} from '../common'
import AddAccount from './add-account'

type HeaderTitleProps = {|
  accountID: Types.AccountID,
  accountName: string,
  isDefault: boolean,
  username: string,
|}

export const HeaderTitle = (props: HeaderTitleProps) => (
  <Kb.Box2 direction="horizontal">
    <Kb.Box2 alignItems="flex-end" direction="horizontal" style={styles.left}>
      <AddAccount />
    </Kb.Box2>
    <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.accountInfo}>
      <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny" style={styles.accountNameContainer}>
        {props.isDefault && <Kb.Avatar size={16} username={props.username} />}
        <Kb.Text type="Header" lineClamp={1}>
          {props.accountName}
        </Kb.Text>
      </Kb.Box2>
      <SmallAccountID accountID={props.accountID} />
    </Kb.Box2>
  </Kb.Box2>
)

type HeaderRightActionsProps = {|
  onReceive: () => void,
|}

export const HeaderRightActions = (props: HeaderRightActionsProps) => (
  <Kb.Box2 alignItems="flex-end" direction="horizontal" gap="tiny" style={styles.rightActions}>
    <SendButton small={true} />
    <Kb.Button type="Wallet" mode="Secondary" label="Receive" small={true} onClick={props.onReceive} />
    <DropdownButton small={true} />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  accountInfo: {
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.xsmall,
  },
  accountNameContainer: {
    alignSelf: 'flex-start',
  },
  left: {
    alignSelf: 'stretch',
    minWidth: 240,
    paddingBottom: 6,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
  },
  rightActions: {
    alignSelf: 'stretch',
    paddingBottom: 6,
    paddingRight: Styles.globalMargins.xsmall,
  },
})
