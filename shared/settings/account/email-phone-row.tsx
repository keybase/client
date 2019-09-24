import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {isMobile} from '../../constants/platform'

// props exported for stories
export type Props = {
  address: string
  onDelete: () => void
  onMakePrimary: () => void
  onToggleSearchable: () => void
  onVerify: () => void
  primary: boolean
  searchable: boolean
  superseded: boolean
  type: 'phone' | 'email'
  verified: boolean
  lastVerifyEmailDate?: number
  moreThanOneEmail?: boolean
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
  // Short circuit superseded phone numbers - they get their own banner instead
  if (props.superseded) {
    return null
  }

  // less than 30 minutes ago
  const hasRecentVerifyEmail =
    props.lastVerifyEmailDate && new Date().getTime() / 1000 - props.lastVerifyEmailDate < 30 * 60

  let subtitle = ''

  if (isMobile && hasRecentVerifyEmail && !props.verified) {
    subtitle = 'Check your inbox'
  } else {
    if (hasRecentVerifyEmail && !props.verified) {
      subtitle = addSpacer(subtitle, 'Check your inbox')
    }
    if (props.type === 'email' && props.primary) {
      subtitle = addSpacer(subtitle, 'Primary')
    }
    if (!props.searchable) {
      subtitle = addSpacer(subtitle, 'Not searchable')
    }
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
  if (props.verified) {
    const copyType = props.type === 'email' ? 'email' : 'number'
    menuItems.push({
      decoration: props.searchable ? undefined : badge(Styles.globalColors.blue, true),
      onClick: props.onToggleSearchable,
      subTitle: props.searchable
        ? `Don't let friends find you by this ${copyType}.`
        : `${Styles.isMobile ? '' : '(Recommended) '}Let friends find you by this ${copyType}.`,
      title: props.searchable ? 'Make unsearchable' : 'Make searchable',
    })
  }

  if (menuItems.length > 0) {
    menuItems.push('Divider')
  }
  const isUndeletableEmail = props.type === 'email' && props.moreThanOneEmail && props.primary
  const deleteItem = isUndeletableEmail
    ? {
        disabled: true,
        onClick: null,
        subTitle:
          'You need to delete your other emails, or make another one primary, before you can delete this email.',
        title: 'Delete',
      }
    : {danger: true, onClick: props.onDelete, title: 'Delete'}
  menuItems.push(deleteItem)

  let gearIconBadge: React.ReactNode | null = null
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
        {props.primary && <Kb.Text type="BodySmall">Primary</Kb.Text>}
      </Kb.Box2>
    ),
  }

  return (
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.container}>
      <Kb.Box2 alignItems="flex-start" direction="vertical" style={{...Styles.globalStyles.flexOne}}>
        <Kb.Text type="BodySemibold" selectable={true} lineClamp={1}>
          {props.address}
        </Kb.Text>
        {(!!subtitle || !props.verified) && (
          <Kb.Box2 direction="horizontal" alignItems="flex-start" gap="xtiny" fullWidth={true}>
            {!props.verified && <Kb.Meta backgroundColor={Styles.globalColors.red} title="UNVERIFIED" />}
            {!!subtitle && <Kb.Text type="BodySmall">{subtitle}</Kb.Text>}
          </Kb.Box2>
        )}
      </Kb.Box2>
      {!!menuItems.length && (
        <>
          <Kb.ClickableBox
            className="hover_container"
            onClick={props.toggleShowingMenu}
            style={styles.gearIconContainer}
          >
            <Kb.Icon
              className="hover_contained_color_black"
              type="iconfont-gear"
              ref={props.setAttachmentRef}
              style={styles.gearIcon}
            />
            {gearIconBadge}
          </Kb.ClickableBox>
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        borderRadius: Styles.isMobile ? 5 : 4,
        height: Styles.isMobile ? 10 : 8,
        width: Styles.isMobile ? 10 : 8,
      },
      badgeGearIcon: {
        position: 'absolute',
        right: 1,
        top: 3,
      },
      badgeMenuItem: {
        alignSelf: 'center',
        marginLeft: 'auto',
      },
      container: {
        height: Styles.isMobile ? 48 : 40,
      },
      gearIcon: Styles.platformStyles({
        isElectron: {...Styles.desktopStyles.clickable},
      }),
      gearIconContainer: {
        padding: Styles.globalMargins.xtiny,
        position: 'relative',
      },
      menuHeader: {
        height: 64,
      },
      menuNoGrow: Styles.platformStyles({isElectron: {width: 220}}),
    } as const)
)

// props exported for stories
export type OwnProps = {
  contactKey: string
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => ({
  _emailRow: (state.settings.email.emails && state.settings.email.emails.get(ownProps.contactKey)) || null,
  _phoneRow:
    (state.settings.phoneNumbers.phones && state.settings.phoneNumbers.phones.get(ownProps.contactKey)) ||
    null,
  moreThanOneEmail: state.settings.email.emails && state.settings.email.emails.size > 1,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  _onMakeNotSearchable: () =>
    dispatch(SettingsGen.createEditEmail({email: ownProps.contactKey, makeSearchable: false})),
  _onMakeSearchable: () =>
    dispatch(SettingsGen.createEditEmail({email: ownProps.contactKey, makeSearchable: true})),
  email: {
    _onDelete: (address: string, searchable: boolean, lastEmail: boolean) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {
                address,
                lastEmail,
                searchable,
                type: 'email',
              },
              selected: 'settingsDeleteAddress',
            },
          ],
        })
      ),
    onMakePrimary: () =>
      dispatch(SettingsGen.createEditEmail({email: ownProps.contactKey, makePrimary: true})),
    onVerify: () => dispatch(SettingsGen.createEditEmail({email: ownProps.contactKey, verify: true})),
  },
  phone: {
    _onDelete: (address: string, searchable: boolean) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {
                address,
                searchable,
                type: 'phone',
              },
              selected: 'settingsDeleteAddress',
            },
          ],
        })
      ),
    _onToggleSearchable: (setSearchable: boolean) =>
      dispatch(SettingsGen.createEditPhone({phone: ownProps.contactKey, setSearchable})),
    _onVerify: phoneNumber => {
      dispatch(SettingsGen.createResendVerificationForPhoneNumber({phoneNumber}))
      dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsVerifyPhone']}))
    },
    onMakePrimary: () => {}, // this is not a supported phone action
  },
})

const ConnectedEmailPhoneRow = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    if (stateProps._phoneRow) {
      const pr = stateProps._phoneRow
      return {
        address: pr.displayNumber,
        onDelete: () => dispatchProps.phone._onDelete(ownProps.contactKey, pr.searchable),
        onMakePrimary: dispatchProps.phone.onMakePrimary,
        onToggleSearchable: () => dispatchProps.phone._onToggleSearchable(!pr.searchable),
        onVerify: () => dispatchProps.phone._onVerify(pr.e164),
        primary: false,
        searchable: pr.searchable,
        superseded: pr.superseded,
        type: 'phone' as const,
        verified: pr.verified,
      }
    } else if (stateProps._emailRow) {
      const searchable = stateProps._emailRow.visibility === RPCTypes.IdentityVisibility.public
      return {
        ...dispatchProps.email,
        address: stateProps._emailRow.email,
        lastVerifyEmailDate: stateProps._emailRow.lastVerifyEmailDate || undefined,
        moreThanOneEmail: stateProps.moreThanOneEmail,
        onDelete: () =>
          dispatchProps.email._onDelete(ownProps.contactKey, searchable, !stateProps.moreThanOneEmail),
        onMakePrimary: dispatchProps.email.onMakePrimary,
        onToggleSearchable: searchable ? dispatchProps._onMakeNotSearchable : dispatchProps._onMakeSearchable,
        onVerify: dispatchProps.email.onVerify,
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
