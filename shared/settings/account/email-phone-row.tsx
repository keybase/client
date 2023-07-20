import * as RouterConstants from '../../constants/router2'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/settings'
import * as RPCTypes from '../../constants/types/rpc-gen'
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

const EmailPhoneRow = (props: Props) => {
  const {address, onDelete, onMakePrimary, onToggleSearchable, onVerify, moreThanOneEmail} = props
  const {primary, searchable, superseded, type, verified, lastVerifyEmailDate} = props

  const menuItems = React.useMemo(() => {
    const menuItems: Kb.MenuItems = []
    if (!verified) {
      menuItems.push({
        decoration: verified ? undefined : badge(Styles.globalColors.orange, true),
        icon: 'iconfont-lock',
        onClick: onVerify,
        title: 'Verify',
      })
    }
    if (type === 'email' && !primary) {
      menuItems.push({
        icon: 'iconfont-star',
        onClick: onMakePrimary,
        subTitle: 'Use this email for important notifications.',
        title: 'Make primary',
      })
    }
    if (verified) {
      const copyType = type === 'email' ? 'email' : 'number'
      menuItems.push({
        decoration: searchable ? undefined : badge(Styles.globalColors.blue, true),
        icon: searchable ? 'iconfont-hide' : 'iconfont-unhide',
        onClick: onToggleSearchable,
        subTitle: searchable
          ? `Don't let friends find you by this ${copyType}.`
          : `${Styles.isMobile ? '' : '(Recommended) '}Let friends find you by this ${copyType}.`,
        title: searchable ? 'Make unsearchable' : 'Make searchable',
      })
    }

    if (menuItems.length > 0) {
      menuItems.push('Divider')
    }
    const isUndeletableEmail = type === 'email' && moreThanOneEmail && primary
    const deleteItem: Kb.MenuItem = isUndeletableEmail
      ? {
          disabled: true,
          icon: 'iconfont-trash',
          subTitle:
            'You need to delete your other emails, or make another one primary, before you can delete this email.',
          title: 'Delete',
        }
      : {danger: true, icon: 'iconfont-trash', onClick: onDelete, title: 'Delete'}
    menuItems.push(deleteItem)
    return menuItems
  }, [
    moreThanOneEmail,
    onDelete,
    onMakePrimary,
    onToggleSearchable,
    onVerify,
    primary,
    searchable,
    type,
    verified,
  ])

  const header = React.useMemo(
    () => (
      <Kb.Box2 direction="vertical" centerChildren={true} style={styles.menuHeader}>
        <Kb.Text type="BodySmallSemibold">{address}</Kb.Text>
        {primary && <Kb.Text type="BodySmall">Primary</Kb.Text>}
      </Kb.Box2>
    ),
    [address, primary]
  )

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          closeText="Cancel"
          visible={true}
          position="bottom right"
          header={Styles.isMobile ? header : undefined}
          onHidden={toggleShowingPopup}
          items={menuItems}
          closeOnSelect={true}
        />
      )
    },
    [menuItems, header]
  )

  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  // Short circuit superseded phone numbers - they get their own banner instead
  if (superseded) {
    return null
  }

  // less than 30 minutes ago
  const hasRecentVerifyEmail =
    lastVerifyEmailDate && new Date().getTime() / 1000 - lastVerifyEmailDate < 30 * 60

  let subtitle = ''

  if (isMobile && hasRecentVerifyEmail && !verified) {
    subtitle = 'Check your inbox'
  } else {
    if (hasRecentVerifyEmail && !verified) {
      subtitle = addSpacer(subtitle, 'Check your inbox')
    }
    if (type === 'email' && primary) {
      subtitle = addSpacer(subtitle, 'Primary')
    }
    if (!searchable) {
      subtitle = addSpacer(subtitle, 'Not searchable')
    }
  }

  let gearIconBadge: React.ReactNode | null = null
  if (!verified) {
    gearIconBadge = badge(Styles.globalColors.orange)
  } else if (!searchable) {
    gearIconBadge = badge(Styles.globalColors.blue)
  }

  return (
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.container}>
      <Kb.Box2 alignItems="flex-start" direction="vertical" style={{...Styles.globalStyles.flexOne}}>
        <Kb.Text type="BodySemibold" selectable={true} lineClamp={1}>
          {address}
        </Kb.Text>
        {(!!subtitle || !verified) && (
          <Kb.Box2 direction="horizontal" alignItems="flex-start" gap="xtiny" fullWidth={true}>
            {!verified && <Kb.Meta backgroundColor={Styles.globalColors.red} title="UNVERIFIED" />}
            {!!subtitle && <Kb.Text type="BodySmall">{subtitle}</Kb.Text>}
          </Kb.Box2>
        )}
      </Kb.Box2>
      {!!menuItems.length && (
        <>
          <Kb.ClickableBox
            className="hover_container"
            onClick={toggleShowingPopup}
            ref={popupAnchor}
            style={styles.gearIconContainer}
          >
            <Kb.Icon className="hover_contained_color_black" type="iconfont-gear" style={styles.gearIcon} />
            {gearIconBadge}
          </Kb.ClickableBox>
          {popup}
        </>
      )}
    </Kb.Box2>
  )
}

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
    }) as const
)

// props exported for stories
export type OwnProps = {
  contactKey: string
}

const ConnectedEmailPhoneRow = (ownProps: OwnProps) => {
  const _emailRow = Constants.useEmailState(s => s.emails.get(ownProps.contactKey) ?? null)
  const _phoneRow = Constants.usePhoneState(s => s.phones?.get(ownProps.contactKey) || null)
  const moreThanOneEmail = Constants.useEmailState(s => s.emails.size > 1)
  const editEmail = Constants.useEmailState(s => s.dispatch.editEmail)
  const _onMakeNotSearchable = () => {
    editEmail({email: ownProps.contactKey, makeSearchable: false})
  }
  const _onMakeSearchable = () => {
    editEmail({email: ownProps.contactKey, makeSearchable: true})
  }

  const editPhone = Constants.usePhoneState(s => s.dispatch.editPhone)
  const resendVerificationForPhoneNumber = Constants.usePhoneState(s => s.dispatch.resendVerificationForPhone)
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)

  const dispatchProps = {
    email: {
      _onDelete: (address: string, searchable: boolean, lastEmail: boolean) =>
        navigateAppend({
          props: {address, lastEmail, searchable, type: 'email'},
          selected: 'settingsDeleteAddress',
        }),
      onMakePrimary: () => {
        editEmail({email: ownProps.contactKey, makePrimary: true})
      },
      onVerify: () => {
        editEmail({email: ownProps.contactKey, verify: true})
      },
    },
    phone: {
      _onDelete: (address: string, searchable: boolean) =>
        navigateAppend({props: {address, searchable, type: 'phone'}, selected: 'settingsDeleteAddress'}),
      _onToggleSearchable: (setSearchable: boolean) => {
        editPhone(ownProps.contactKey, undefined, setSearchable)
      },
      _onVerify: (phoneNumber: string) => {
        resendVerificationForPhoneNumber(phoneNumber)
        navigateAppend('settingsVerifyPhone')
      },
      onMakePrimary: () => {}, // this is not a supported phone action
    },
  }
  const props = (() => {
    if (_phoneRow) {
      const pr = _phoneRow
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
    } else if (_emailRow) {
      const searchable = _emailRow.visibility === RPCTypes.IdentityVisibility.public
      return {
        ...dispatchProps.email,
        address: _emailRow.email,
        lastVerifyEmailDate: _emailRow.lastVerifyEmailDate || undefined,
        moreThanOneEmail: moreThanOneEmail,
        onDelete: () => dispatchProps.email._onDelete(ownProps.contactKey, searchable, !moreThanOneEmail),
        onMakePrimary: dispatchProps.email.onMakePrimary,
        onToggleSearchable: searchable ? _onMakeNotSearchable : _onMakeSearchable,
        onVerify: dispatchProps.email.onVerify,
        primary: _emailRow.isPrimary,
        searchable,
        superseded: false,
        type: 'email' as const,
        verified: _emailRow.isVerified,
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
        superseded: false,
        type: 'phone' as const,
        verified: false,
      }
  })()

  return <EmailPhoneRow {...props} />
}
export default ConnectedEmailPhoneRow
