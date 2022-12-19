import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type * as Types from '../../constants/types/wallets'
import {SmallAccountID, SendButton} from '../common'
import {HeaderRightActions as ConnectedHeaderRightActions} from './container'

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
    <Kb.Box2 direction="horizontal" style={styles.accountArea}>
      <Kb.Box2 alignItems="flex-end" direction="horizontal" style={styles.left}></Kb.Box2>
      <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.accountInfo}>
        {props.loading ? (
          <Kb.ProgressIndicator type="Small" style={styles.loading} />
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
      {Styles.isTablet && <ConnectedHeaderRightActions />}
    </Kb.Box2>
  )

type HeaderRightActionsProps = {
  loading: boolean
  noDisclaimer: boolean
  onReceive: () => void
  onSettings: () => void
}

export const HeaderRightActions = (props: HeaderRightActionsProps) =>
  props.noDisclaimer ? null : (
    <Kb.Box2 alignItems="flex-end" direction="horizontal" gap="tiny" style={styles.rightActions}>
      <SendButton small={true} />
      <Kb.Button
        type="Wallet"
        mode="Secondary"
        label="Receive"
        small={true}
        onClick={props.onReceive}
        disabled={props.loading}
      />
      <Kb.Button
        onClick={props.onSettings}
        mode="Secondary"
        small={true}
        type="Wallet"
        disabled={props.loading}
      >
        <Kb.Icon type="iconfont-gear" style={styles.gear} />
      </Kb.Button>
    </Kb.Box2>
  )

const styles = Styles.styleSheetCreate(
  () =>
    ({
      accountArea: Styles.platformStyles({
        isTablet: {flexGrow: 1},
      }),
      accountID: Styles.platformStyles({
        isElectron: {...Styles.desktopStyles.windowDraggingClickable},
      }),
      accountInfo: Styles.platformStyles({
        common: {
          maxHeight: 39,
          paddingBottom: Styles.globalMargins.xtiny,
          paddingLeft: Styles.globalMargins.xsmall,
        },
        isTablet: {
          flex: 1,
          flexGrow: 1,
          flexShrink: 0,
        },
      }),
      accountNameContainer: Styles.platformStyles({
        common: {alignSelf: 'flex-start'},
        isElectron: {
          ...Styles.desktopStyles.windowDraggingClickable,
          marginTop: -Styles.globalMargins.xxtiny,
        },
      }),
      gear: {
        position: 'relative',
        top: 1,
      },
      left: Styles.platformStyles({
        common: {
          minWidth: Styles.globalStyles.mediumSubNavWidth,
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
          width: Styles.globalStyles.mediumSubNavWidth,
        },
        isElectron: {...Styles.desktopStyles.windowDraggingClickable},
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
        isElectron: {...Styles.desktopStyles.windowDraggingClickable},
        isTablet: {
          alignSelf: 'flex-end',
          paddingRight: 0,
        },
      }),
    } as const)
)
