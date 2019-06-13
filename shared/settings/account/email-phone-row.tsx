import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'

// props exported for stories
export type Props = {
  address: string
  onDelete: () => void
  onMakePrimary: () => void
  onToggleSearchable: () => void
  onVerify: () => void
  primary: boolean
  searchable: boolean
  type: 'phone' | 'email'
  verified: boolean
}

const addSpacer = (into: string, add: string) => {
  return into + (into.length ? ' • ' : '') + add
}

const badge = (backgroundColor: string, menuItem: boolean = false) => (
  <Kb.Box
    style={Styles.collapseStyles([
      styles.badge,
      menuItem ? styles.badgeMenuItem : styles.badgeGearIcon,
      {backgroundColor},
    ])}
  />
)

const _EmailPhoneRow = (props: Kb.PropsWithOverlay<Props>) => {
  let subtitle = ''
  if (props.type === 'email' && props.primary) {
    subtitle = addSpacer(subtitle, 'Primary email')
    // TODO 'Check your inbox' if verification email was just sent
  }
  if (!props.searchable) {
    subtitle = addSpacer(subtitle, 'Not searchable')
  }

  const menuItems = []
  if (!props.verified) {
    menuItems.push({
      decoration: props.verified ? undefined : badge(Styles.globalColors.orange, true),
      onClick: props.onVerify,
      title: 'Verify',
    })
  }
  if (props.type === 'email' && !props.primary && props.verified) {
    menuItems.push({
      onClick: props.onMakePrimary,
      subTitle: 'Use this email for important notifications.',
      title: 'Make primary',
    })
  }
  if (props.verified) {
    menuItems.push({
      decoration: props.searchable ? undefined : badge(Styles.globalColors.blue, true),
      onClick: props.onToggleSearchable,
      subTitle: props.searchable
        ? 'Disallow friends to find you by this email.'
        : `${Styles.isMobile ? '' : '(Recommended) '}Allow friends to find you by this email.`,
      title: props.searchable ? "Don't make searchable" : 'Make searchable',
    })
  }
  menuItems.push('Divider', {danger: true, onClick: props.onDelete, title: 'Delete'})

  let gearIconBadge = null
  if (!props.verified) {
    gearIconBadge = badge(Styles.globalColors.orange)
  } else if (!props.searchable) {
    gearIconBadge = badge(Styles.globalColors.blue)
  }

  const header = {
    title: 'emailPhoneHeader',
    view: (
      <Kb.Box2 direction="vertical" centerChildren={true} style={styles.menuHeader}>
        <Kb.Text type="BodySmallSemibold">{props.address}</Kb.Text>
        {props.primary && <Kb.Text type="BodySmall">Primary email</Kb.Text>}
      </Kb.Box2>
    ),
  }

  return (
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.container}>
      <Kb.Box2 alignItems="flex-start" direction="vertical" style={{...Styles.globalStyles.flexOne}}>
        <Kb.Text type="BodySemibold">{props.address}</Kb.Text>
        {(!!subtitle || !props.verified) && (
          <Kb.Box2 direction="horizontal" alignItems="flex-start" gap="xtiny" fullWidth={true}>
            {!props.verified && <Kb.Meta backgroundColor={Styles.globalColors.red} title="UNVERIFIED" />}
            {!!subtitle && <Kb.Text type="BodySmall">{subtitle}</Kb.Text>}
          </Kb.Box2>
        )}
      </Kb.Box2>
      <Kb.Box style={styles.positionRelative}>
        <Kb.Icon type="iconfont-gear" ref={props.setAttachmentRef} onClick={props.toggleShowingMenu} />
        {gearIconBadge}
      </Kb.Box>
      <Kb.FloatingMenu
        attachTo={props.getAttachmentRef}
        closeText="Cancel"
        containerStyle={styles.menuNoGrow}
        visible={props.showingMenu}
        position="bottom right"
        header={Styles.isMobile ? header : null}
        items={menuItems}
        closeOnSelect={true}
        onHidden={props.toggleShowingMenu}
      />
    </Kb.Box2>
  )
}
const EmailPhoneRow = Kb.OverlayParentHOC(_EmailPhoneRow)

const styles = Styles.styleSheetCreate({
  badge: {
    borderRadius: Styles.isMobile ? 5 : 4,
    height: Styles.isMobile ? 10 : 8,
    width: Styles.isMobile ? 10 : 8,
  },
  badgeGearIcon: {
    position: 'absolute',
    right: -3,
    top: -2,
  },
  badgeMenuItem: {
    alignSelf: 'center',
    marginLeft: 'auto',
  },
  container: {
    height: Styles.isMobile ? 48 : 40,
  },
  menuHeader: {
    height: 64,
  },
  menuNoGrow: Styles.platformStyles({isElectron: {width: 220}}),
  positionRelative: {position: 'relative'},
})

// props exported for stories
export type OwnProps = {
  contactKey: string
}

// TODO mocked for now
const mapStateToProps = (state, ownProps) => ({})
const mapDispatchToProps = dispatch => ({})
const mergeProps = (stateProps, dispatchProps, ownProps) =>
  ({
    address: '',
    onDelete: () => {},
    onMakePrimary: () => {},
    onToggleSearchable: () => {},
    onVerify: () => {},
    primary: false,
    searchable: false,
    type: 'phone',
    verified: false,
  } as const)

const ConnectedEmailPhoneRow = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedEmailPhoneRow'
)(EmailPhoneRow)

export default ConnectedEmailPhoneRow
