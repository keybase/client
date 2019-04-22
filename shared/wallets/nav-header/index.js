// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/wallets'
import {SmallAccountID} from '../common'
import AddAccount from './add-account'

type HeaderTitleProps = {|
  accountID: Types.AccountID,
  accountName: string,
  isDefault: boolean,
  username: string,
|}

export const HeaderTitle = (props: HeaderTitleProps) => (
  <Kb.Box2 direction="horizontal">
    <Kb.Box2 direction="horizontal" style={styles.left}>
      <AddAccount />
    </Kb.Box2>
    <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.accountInfo}>
      <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny" style={styles.accountNameContainer}>
        {props.isDefault && <Kb.Avatar size={16} username={props.username} />}
        <Kb.Text type="Header">{props.accountName}</Kb.Text>
      </Kb.Box2>
      <SmallAccountID accountID={props.accountID} />
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  accountInfo: {
    paddingLeft: Styles.globalMargins.xsmall,
  },
  accountNameContainer: {
    alignSelf: 'flex-start',
  },
  left: {
    minWidth: 240,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
  },
})
