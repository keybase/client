import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as SettingsGen from '../../actions/settings-gen'
import flags from '../../util/feature-flags'
import * as RouteTreeGen from '../../actions/route-tree-gen'

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
    subtitle = addSpacer(subtitle, 'Primary')
    // TODO 'Check your inbox' if verification email was just sent
  }
  if (!props.searchable && flags.sbsContacts) {
    subtitle = addSpacer(subtitle, 'Not searchable')
  }

  const menuItems: Kb.MenuItems = []
  if (!props.verified) {
    menuItems.push({
      decoration: props.verified ? undefined : badge(Styles.globalColors.orange, true),
      onClick: props.onVerify,
      title: 'Verify',
    })
  }
  if (props.type === 'email' && !props.primary) {
    menuItems.push({
      onClick: props.onMakePrimary,
      subTitle: 'Use this email for important notifications.',
      title: 'Make primary',
    })
  }
  if (props.verified && flags.sbsContacts) {
    menuItems.push({
      decoration: props.searchable ? undefined : badge(Styles.globalColors.blue, true),
      onClick: props.onToggleSearchable,
      subTitle: props.searchable
        ? `Don't let friends find you by this ${props.type}.`
        : `${Styles.isMobile ? '' : '(Recommended) '}Let friends find you by this ${props.type}.`,
      title: props.searchable ? 'Make unsearchable' : 'Make searchable',
    })
  }

  // TODO: Drop this `if` once Y2K-180 is done.
  if (!props.primary) {
    menuItems.push('Divider', {
      danger: true,
      onClick: props.onDelete,
      title: 'Delete',
    })
  }

  let gearIconBadge: React.ReactNode | null = null
  if (!props.verified) {
    gearIconBadge = badge(Styles.globalColors.orange)
  } else if (!props.searchable && flags.sbsContacts) {
    gearIconBadge = badge(Styles.globalColors.blue)
  }

  const header = {
    title: 'emailPhoneHeader',
    view: (
      <Kb.Box2 direction="vertical" centerChildren={true} style={styles.menuHeader}>
        <Kb.Text type="BodySmallSemibold">{props.address}</Kb.Text>
        {props.primary && <Kb.Text type="BodySmall">Primary</Kb.Text>}
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
      {!!menuItems.length && (
        <>
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
            header={Styles.isMobile ? header : undefined}
            items={menuItems}
            closeOnSelect={true}
            onHidden={props.toggleShowingMenu}
          />
        </>
      )}
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

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => ({
  _emailRow: (state.settings.email.emails && state.settings.email.emails.get(ownProps.contactKey)) || null,
  _phoneRow:
    (state.settings.phoneNumbers.phones && state.settings.phoneNumbers.phones.get(ownProps.contactKey)) ||
    null,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  _onMakeNotSearchable: () =>
    dispatch(SettingsGen.createEditEmail({email: ownProps.contactKey, makeSearchable: false})),
  _onMakeSearchable: () =>
    dispatch(SettingsGen.createEditEmail({email: ownProps.contactKey, makeSearchable: true})),
  email: {
    onDelete: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {address: ownProps.contactKey, type: 'email'}, selected: 'settingsDeleteAddress'}],
        })
      ),
    onMakePrimary: () =>
      dispatch(SettingsGen.createEditEmail({email: ownProps.contactKey, makePrimary: true})),
    onVerify: () => dispatch(SettingsGen.createEditEmail({email: ownProps.contactKey, verify: true})),
  },
  phone: {
    _onVerify: phoneNumber => {
      dispatch(SettingsGen.createResendVerificationForPhoneNumber({phoneNumber}))
      dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsVerifyPhone']}))
    },
    onDelete: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {address: ownProps.contactKey, type: 'phone'}, selected: 'settingsDeleteAddress'}],
        })
      ),
    onMakePrimary: () => {}, // this is not a supported phone action
    onToggleSearchable: () =>
      dispatch(SettingsGen.createEditPhone({phone: ownProps.contactKey, toggleSearchable: true})),
  },
})

const ConnectedEmailPhoneRow = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => {
    if (stateProps._phoneRow) {
      const searchable = stateProps._phoneRow.visibility === RPCTypes.IdentityVisibility.public
      return {
        address: stateProps._phoneRow.phoneNumber,
        onDelete: dispatchProps.phone.onDelete,
        onMakePrimary: dispatchProps.phone.onMakePrimary,
        onToggleSearchable: dispatchProps.phone.onToggleSearchable,
        onVerify: () =>
          stateProps._phoneRow && dispatchProps.phone._onVerify(stateProps._phoneRow.phoneNumber),
        primary: false,
        searchable,
        type: 'phone' as const,
        verified: stateProps._phoneRow.verified,
      }
    } else if (stateProps._emailRow) {
      const searchable = stateProps._emailRow.visibility === RPCTypes.IdentityVisibility.public
      return {
        ...dispatchProps.email,
        address: stateProps._emailRow.email,
        onToggleSearchable: searchable ? dispatchProps._onMakeNotSearchable : dispatchProps._onMakeSearchable,
        primary: stateProps._emailRow.isPrimary,
        searchable,
        type: 'email' as const,
        verified: stateProps._emailRow.isVerified,
      }
    } else
      return {
        address: '',
        onDelete: () => {},
        onMakePrimary: () => {},
        onToggleSearchable: () => {},
        onVerify: () => {},
        primary: false,
        searchable: false,
        type: 'phone' as const,
        verified: false,
      }
  },
  'ConnectedEmailPhoneRow'
)(EmailPhoneRow)

export default ConnectedEmailPhoneRow
