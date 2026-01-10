import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {useSettingsEmailState} from '@/stores/settings-email'

const addSpacer = (into: string, add: string) => {
  return into + (into.length ? ' • ' : '') + add
}

const Badge = (p: {backgroundColor: string; menuItem?: boolean}) => (
  <Kb.Box
    style={Kb.Styles.collapseStyles([
      styles.badge,
      p.menuItem ? styles.badgeMenuItem : styles.badgeGearIcon,
      {backgroundColor: p.backgroundColor},
    ])}
  />
)

const EmailPhoneRow = (p: {contactKey: string}) => {
  const props = useData(p.contactKey)
  const {address, onDelete, onMakePrimary, onToggleSearchable, onVerify, moreThanOneEmail} = props
  const {primary, searchable, superseded, type, verified, lastVerifyEmailDate} = props

  const menuItems = React.useMemo(() => {
    const menuItems: Kb.MenuItems = []
    if (!verified) {
      menuItems.push({
        decoration: <Badge backgroundColor={Kb.Styles.globalColors.orange} menuItem={true} />,
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
        decoration: searchable ? undefined : (
          <Badge backgroundColor={Kb.Styles.globalColors.blue} menuItem={true} />
        ),
        icon: searchable ? 'iconfont-hide' : 'iconfont-unhide',
        onClick: onToggleSearchable,
        subTitle: searchable
          ? `Don't let friends find you by this ${copyType}.`
          : `${Kb.Styles.isMobile ? '' : '(Recommended) '}Let friends find you by this ${copyType}.`,
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
      const {attachTo, hidePopup} = p
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          closeText="Cancel"
          visible={true}
          position="bottom right"
          header={Kb.Styles.isMobile ? header : undefined}
          onHidden={hidePopup}
          items={menuItems}
          closeOnSelect={true}
        />
      )
    },
    [menuItems, header]
  )

  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  // Short circuit superseded phone numbers - they get their own banner instead
  if (superseded) {
    return null
  }

  // less than 30 minutes ago
  const hasRecentVerifyEmail =
    lastVerifyEmailDate && new Date().getTime() / 1000 - lastVerifyEmailDate < 30 * 60

  let subtitle = ''

  if (C.isMobile && hasRecentVerifyEmail && !verified) {
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
    gearIconBadge = <Badge backgroundColor={Kb.Styles.globalColors.orange} />
  } else if (!searchable) {
    gearIconBadge = <Badge backgroundColor={Kb.Styles.globalColors.blue} />
  }

  return (
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.container}>
      <Kb.Box2 alignItems="flex-start" direction="vertical" style={{...Kb.Styles.globalStyles.flexOne}}>
        <Kb.Text type="BodySemibold" selectable={true} lineClamp={1}>
          {address}
        </Kb.Text>
        {(!!subtitle || !verified) && (
          <Kb.Box2 direction="horizontal" alignItems="flex-start" gap="xtiny" fullWidth={true}>
            {!verified && <Kb.Meta backgroundColor={Kb.Styles.globalColors.red} title="UNVERIFIED" />}
            {!!subtitle && <Kb.Text type="BodySmall">{subtitle}</Kb.Text>}
          </Kb.Box2>
        )}
      </Kb.Box2>
      {!!menuItems.length && (
        <>
          <Kb.ClickableBox
            className="hover_container"
            onClick={showPopup}
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        borderRadius: Kb.Styles.isMobile ? 5 : 4,
        height: Kb.Styles.isMobile ? 10 : 8,
        width: Kb.Styles.isMobile ? 10 : 8,
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
        height: Kb.Styles.isMobile ? 48 : 40,
      },
      gearIcon: Kb.Styles.platformStyles({
        isElectron: {...Kb.Styles.desktopStyles.clickable},
      }),
      gearIconContainer: {
        padding: Kb.Styles.globalMargins.xtiny,
        position: 'relative',
      },
      menuHeader: {
        height: 64,
      },
    }) as const
)

const useData = (contactKey: string) => {
  const _emailRow = useSettingsEmailState(s => s.emails.get(contactKey) ?? null)
  const _phoneRow = useSettingsPhoneState(s => s.phones?.get(contactKey) || null)
  const moreThanOneEmail = useSettingsEmailState(s => s.emails.size > 1)
  const editEmail = useSettingsEmailState(s => s.dispatch.editEmail)
  const _onMakeNotSearchable = () => {
    editEmail({email: contactKey, makeSearchable: false})
  }
  const _onMakeSearchable = () => {
    editEmail({email: contactKey, makeSearchable: true})
  }

  const editPhone = useSettingsPhoneState(s => s.dispatch.editPhone)
  const resendVerificationForPhoneNumber = useSettingsPhoneState(s => s.dispatch.resendVerificationForPhone)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

  const dispatchProps = {
    email: {
      _onDelete: (address: string, searchable: boolean, lastEmail: boolean) =>
        navigateAppend({
          props: {address, lastEmail, searchable, type: 'email'},
          selected: 'settingsDeleteAddress',
        }),
      onMakePrimary: () => {
        editEmail({email: contactKey, makePrimary: true})
      },
      onVerify: () => {
        editEmail({email: contactKey, verify: true})
      },
    },
    phone: {
      _onDelete: (address: string, searchable: boolean) =>
        navigateAppend({props: {address, searchable, type: 'phone'}, selected: 'settingsDeleteAddress'}),
      _onToggleSearchable: (setSearchable: boolean) => {
        editPhone(contactKey, undefined, setSearchable)
      },
      _onVerify: (phoneNumber: string) => {
        resendVerificationForPhoneNumber(phoneNumber)
        navigateAppend('settingsVerifyPhone')
      },
      onMakePrimary: () => {}, // this is not a supported phone action
    },
  }
  if (_phoneRow) {
    const pr = _phoneRow
    return {
      address: pr.displayNumber,
      lastVerifyEmailDate: undefined,
      moreThanOneEmail,
      onDelete: () => dispatchProps.phone._onDelete(contactKey, pr.searchable),
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
    const searchable = _emailRow.visibility === T.RPCGen.IdentityVisibility.public
    return {
      ...dispatchProps.email,
      address: _emailRow.email,
      lastVerifyEmailDate: _emailRow.lastVerifyEmailDate || undefined,
      moreThanOneEmail,
      onDelete: () => dispatchProps.email._onDelete(contactKey, searchable, !moreThanOneEmail),
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
      lastVerifyEmailDate: undefined,
      moreThanOneEmail,
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
}
export default EmailPhoneRow
