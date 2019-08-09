import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  code: string
  cannotAccept: boolean
  depositButtonText: string
  depositButtonWaitingKey?: string
  expanded: boolean
  firstItem: boolean
  infoUrlText: string
  issuerAccountID: string
  issuerVerifiedDomain: string
  thisDeviceIsLockedOut: boolean
  trusted: boolean // TODO add limit when we support it in GUI
  withdrawButtonWaitingKey?: string
  withdrawButtonText: string

  onAccept: () => void
  onCollapse: () => void
  onExpand: () => void
  onRemove: () => void
  onDeposit?: () => void
  onOpenInfoUrl?: () => void
  onWithdraw?: () => void

  waitingKeyAdd: string
  waitingKeyDelete: string
  waitingRefresh: boolean
}

const stopPropagation = onClick => e => {
  e.stopPropagation()
  onClick && onClick()
}

const getCode = (props: Props) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="xtiny">
    <Kb.Text type="BodyExtrabold" lineClamp={1} ellipsizeMode="tail">
      {props.code}
    </Kb.Text>
    <Kb.Icon sizeType="Tiny" type={props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'} />
  </Kb.Box2>
)

const getIssuerVerifiedDomain = (props: Props) => (
  <Kb.Text type="BodySmall">{props.issuerVerifiedDomain || 'Unknown issuer'}</Kb.Text>
)

const bodyCollapsed = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.bodyCollapsed} fullHeight={true}>
    {getCode(props)}
    {getIssuerVerifiedDomain(props)}
  </Kb.Box2>
)

const bodyExpanded = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.bodyExpanded} fullHeight={true}>
    {getCode(props)}
    {getIssuerVerifiedDomain(props)}
    <Kb.Text type="BodySmall" lineClamp={2} ellipsizeMode="middle">
      {props.issuerAccountID}
    </Kb.Text>
    <Kb.ButtonBar direction="row" align="flex-start" small={true}>
      {!!props.depositButtonText && (
        <Kb.WaitingButton
          mode="Secondary"
          label={props.depositButtonText}
          onClick={stopPropagation(props.onDeposit)}
          small={true}
          type="Wallet"
          waitingKey={props.depositButtonWaitingKey || null}
        />
      )}

      {!!props.withdrawButtonText && (
        <Kb.WaitingButton
          mode="Secondary"
          label={props.withdrawButtonText}
          onClick={stopPropagation(props.onWithdraw)}
          small={true}
          type="Wallet"
          waitingKey={props.withdrawButtonWaitingKey || null}
        />
      )}
      <Kb.Button
        mode="Secondary"
        type="Wallet"
        small={true}
        disabled={!props.onOpenInfoUrl}
        label={props.infoUrlText}
        onClick={stopPropagation(props.onOpenInfoUrl)}
      />
    </Kb.ButtonBar>
  </Kb.Box2>
)

const Asset = (props: Props) => {
  const button = props.trusted ? (
    <Kb.WaitingButton
      mode="Secondary"
      type="Danger"
      small={true}
      label="Remove"
      onClick={stopPropagation(props.onRemove)}
      disabled={props.waitingRefresh || props.thisDeviceIsLockedOut}
      waitingKey={props.waitingKeyDelete}
    />
  ) : (
    <Kb.WaitingButton
      mode="Primary"
      type="Success"
      small={true}
      label="Accept"
      onClick={stopPropagation(props.onAccept)}
      disabled={props.cannotAccept || props.waitingRefresh || props.thisDeviceIsLockedOut}
      waitingKey={props.waitingKeyAdd}
    />
  )
  return (
    <Kb.ListItem2
      firstItem={props.firstItem}
      type="Small"
      height={props.expanded ? expandedHeight : undefined}
      body={
        // We use this instead of the action prop on ListItem2 so that it
        // "floats" on top of the content and the account ID can extend below it
        // rather than being cut off by the action container's left border.
        <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
          {props.expanded ? bodyExpanded(props) : bodyCollapsed(props)}
          <Kb.Box2 direction="vertical" style={styles.actions} centerChildren={true}>
            {props.thisDeviceIsLockedOut ? (
              <Kb.WithTooltip text="You can only send from a mobile device more than 7 days old.">
                {button}
              </Kb.WithTooltip>
            ) : (
              button
            )}
          </Kb.Box2>
        </Kb.Box2>
      }
      onClick={props.expanded ? props.onCollapse : props.onExpand}
    />
  )
}

const nonExpandedHeight = Styles.isMobile ? 56 : 48
const expandedHeight = Styles.isMobile ? 160 : 140

export const getHeight = (props: Props): number => (props.expanded ? expandedHeight : nonExpandedHeight)

const styles = Styles.styleSheetCreate({
  actions: Styles.platformStyles({
    common: {
      position: 'absolute',
      right: Styles.globalMargins.tiny,
    },
    isElectron: {
      top: Styles.globalMargins.tiny + Styles.globalMargins.xxtiny,
    },
    isMobile: {
      top: Styles.globalMargins.tiny + Styles.globalMargins.xtiny,
    },
  }),
  bodyCollapsed: {
    paddingLeft: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  bodyExpanded: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
    isElectron: {
      paddingBottom: Styles.globalMargins.tiny,
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.small,
    },
  }),
  textUnknown: {color: Styles.globalColors.redDark},
})

export default Asset
