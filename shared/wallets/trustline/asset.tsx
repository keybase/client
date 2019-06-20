import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  code: string
  expanded: boolean
  firstItem: boolean
  issuerAccountID: string
  issuerVerifiedDomain: string
  trusted: boolean // TODO add limit when we support it in GUI

  onAccept: () => void
  onCollapse: () => void
  onExpand: () => void
  onRemove: () => void
  onViewDetails: () => void
}

const stopPropagation = onClick => e => {
  e.stopPropagation()
  onClick()
}

const getCode = (props: Props) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="xtiny">
    <Kb.Text type="BodyExtrabold" lineClamp={1} ellipsizeMode="tail">
      {props.code}
    </Kb.Text>
    <Kb.Icon sizeType="Tiny" type={props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'} />
  </Kb.Box2>
)

const getIssuerVerifiedDomain = (props: Props) =>
  props.issuerVerifiedDomain ? (
    <Kb.Text type="BodySmall">{props.issuerVerifiedDomain}</Kb.Text>
  ) : (
    <Kb.Text type="BodySmallItalic" style={styles.textUnknown}>
      Unknown
    </Kb.Text>
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
    <Kb.Text type="BodySmall" style={styles.marginTopXtiny}>
      Issuer:
    </Kb.Text>
    <Kb.Text type="BodySmall" lineClamp={2} ellipsizeMode="middle">
      {props.issuerAccountID}
    </Kb.Text>
    <Kb.Box style={{...Styles.globalStyles.flexBoxRow, flex: 1}} />
    <Kb.Button
      mode="Secondary"
      type="Default"
      small={true}
      label="View details"
      style={Styles.collapseStyles([styles.marginTopXtiny, styles.viewDetails])}
      onClick={stopPropagation(props.onViewDetails)}
    />
  </Kb.Box2>
)

const Asset = (props: Props) => (
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
          {props.trusted ? (
            <Kb.Button
              mode="Secondary"
              type="Danger"
              small={true}
              label="Remove"
              onClick={stopPropagation(props.onRemove)}
            />
          ) : (
            <Kb.Button
              mode="Primary"
              type="Success"
              small={true}
              label="Accept"
              onClick={stopPropagation(props.onAccept)}
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
    }
    onClick={props.expanded ? props.onCollapse : props.onExpand}
  />
)

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
    paddingTop: Styles.globalMargins.tiny,
  },
  bodyExpanded: Styles.platformStyles({
    common: {
      paddingTop: Styles.globalMargins.tiny,
    },
    isElectron: {
      paddingBottom: Styles.globalMargins.tiny,
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.small,
    },
  }),
  marginTopXtiny: {marginTop: Styles.globalMargins.xtiny},
  textUnknown: {color: Styles.globalColors.redDark},
  viewDetails: Styles.platformStyles({
    isElectron: {
      width: 107,
    },
    isMobile: {
      width: 120,
    },
  }),
})

export default Asset
