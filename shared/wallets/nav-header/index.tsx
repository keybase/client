import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/wallets'
import {SmallAccountID, SendButton, DropdownButton} from '../common'
import AddAccount from './add-account'

type HeaderTitleProps = {
  accountID: Types.AccountID
  accountName: string
  isDefault: boolean
  loading: boolean
  noDisclaimer: boolean
  username: string
}

export const HeaderTitle = (props: HeaderTitleProps) =>
  props.noDisclaimer ? null : (
    <Kb.Box2 direction="horizontal">
      <Kb.Box2 alignItems="flex-end" direction="horizontal" style={styles.left}>
        <AddAccount />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.accountInfo}>
        {props.loading ? (
          <Kb.ProgressIndicator type={'Small'} style={styles.loading} />
        ) : (
          <>
            <Kb.Box2
              direction="horizontal"
              alignItems="center"
              gap="tiny"
              style={styles.accountNameContainer}
            >
              {props.isDefault && <Kb.Avatar size={16} username={props.username} />}
              <Kb.Text selectable={true} type="Header" lineClamp={1}>
                {props.accountName}
              </Kb.Text>
            </Kb.Box2>
            <SmallAccountID accountID={props.accountID} style={styles.accountID} />
          </>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )

type HeaderRightActionsProps = {
  noDisclaimer: boolean
  onReceive: () => void
}

export const HeaderRightActions = (props: HeaderRightActionsProps) =>
  props.noDisclaimer ? null : (
    <Kb.Box2 alignItems="flex-end" direction="horizontal" gap="tiny" style={styles.rightActions}>
      <SendButton small={true} />
      <Kb.Button type="Wallet" mode="Secondary" label="Receive" small={true} onClick={props.onReceive} />
      <DropdownButton small={true} />
    </Kb.Box2>
  )

const styles = Styles.styleSheetCreate({
  accountID: Styles.platformStyles({
    isElectron: Styles.desktopStyles.windowDraggingClickable,
  }),
  accountInfo: {
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.xsmall,
  },
  accountNameContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
    },
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
      marginTop: -Styles.globalMargins.xtiny,
    },
  }),
  left: Styles.platformStyles({
    common: {
      minWidth: 240,
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.xsmall,
    },
    isElectron: Styles.desktopStyles.windowDraggingClickable,
  }),
  loading: {
    height: 16,
    width: 16,
  },
  rightActions: Styles.platformStyles({
    common: {
      alignSelf: 'stretch',
      paddingBottom: 6,
      paddingRight: Styles.globalMargins.xsmall,
    },
    isElectron: Styles.desktopStyles.windowDraggingClickable,
  }),
})
