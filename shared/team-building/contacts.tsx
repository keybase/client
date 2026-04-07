import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {useTBContext} from '@/stores/team-building'

const useContactsProps = () => {
  const {
    contactsImported,
    contactsPermissionStatus,
    editContactImportEnabled,
    importContactsLater,
    isImportPromptDismissed,
    loadContactImportEnabled,
    numContactsImported,
    requestPermissions,
  } = useSettingsContactsState(
    C.useShallow(s => ({
      contactsImported: s.importEnabled,
      contactsPermissionStatus: s.permissionStatus,
      editContactImportEnabled: s.dispatch.editContactImportEnabled,
      importContactsLater: s.dispatch.importContactsLater,
      isImportPromptDismissed: s.importPromptDismissed,
      loadContactImportEnabled: s.dispatch.loadContactImportEnabled,
      numContactsImported: s.importedCount || 0,
      requestPermissions: s.dispatch.requestPermissions,
    }))
  )

  const onAskForContactsLater = importContactsLater
  const onLoadContactsSetting = loadContactImportEnabled

  const onImportContactsPermissionsGranted = () => {
    editContactImportEnabled(true, false)
  }
  const onImportContactsPermissionsNotGranted = () => {
    requestPermissions(true, false)
  }

  const onImportContacts =
    contactsPermissionStatus === 'denied'
      ? undefined
      : contactsPermissionStatus === 'granted'
        ? onImportContactsPermissionsGranted
        : onImportContactsPermissionsNotGranted

  return {
    contactsImported,
    contactsPermissionStatus,
    isImportPromptDismissed,
    numContactsImported,
    onAskForContactsLater,
    onImportContacts,
    onLoadContactsSetting,
  }
}

export const ContactsBanner = (props: {
  namespace: T.TB.AllowedNamespace
  selectedService: T.TB.ServiceIdWithContact
  onRedoSearch: () => void
}) => {
  const {onRedoSearch, selectedService} = props
  const {
    contactsImported,
    contactsPermissionStatus,
    isImportPromptDismissed,
    numContactsImported,
    onAskForContactsLater,
    onImportContacts,
    onLoadContactsSetting,
  } = useContactsProps()

  const fetchUserRecs = useTBContext(s => s.dispatch.fetchUserRecs)
  const onRedoRecs = fetchUserRecs
  const prevNumContactsImportedRef = React.useRef(numContactsImported)

  // Redo search if # of imported contacts changes
  React.useEffect(() => {
    if (prevNumContactsImportedRef.current !== numContactsImported) {
      prevNumContactsImportedRef.current = numContactsImported
      onRedoSearch()
      onRedoRecs()
    }
  }, [numContactsImported, onRedoSearch, onRedoRecs])

  // Ensure that we know whether contacts are loaded, and if not, that we load
  // the current config setting.
  React.useEffect(() => {
    if (contactsImported === undefined) {
      onLoadContactsSetting()
    }
  }, [contactsImported, onLoadContactsSetting])

  // If we've imported contacts already, or the user has dismissed the message,
  // then there's nothing for us to do.
  if (
    contactsImported === undefined ||
    selectedService !== 'keybase' ||
    contactsImported ||
    isImportPromptDismissed ||
    contactsPermissionStatus === 'denied' ||
    !onImportContacts
  )
    return null

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.banner}>
      <Kb.ImageIcon type="icon-fancy-contact-import-mobile-72-96" style={styles.bannerIcon} />
      <Kb.Box2 direction="vertical" flex={1} justifyContent="center">
        <Kb.Text type="BodySmallSemibold" negative={true} style={styles.bannerText}>
          Import your phone contacts and start encrypted chats with your friends.
        </Kb.Text>
        <Kb.Box2 direction="horizontal" gap="tiny" style={styles.bannerButtonContainer}>
          <Kb.Button
            label="Import contacts"
            onClick={onImportContacts}
            small={true}
            style={Kb.Styles.collapseStyles([styles.importContactsButton, styles.primaryOnBlue])}
            labelStyle={styles.primaryOnBlueLabel}
          />
          <Kb.Button
            label="Skip"
            mode="Secondary"
            onClick={onAskForContactsLater}
            small={true}
            style={styles.secondaryOnBlue}
            labelStyle={styles.secondaryOnBlueLabel}
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

export const ContactsImportButton = () => {
  const {contactsImported, contactsPermissionStatus, isImportPromptDismissed, onImportContacts} =
    useContactsProps()

  // If we've imported contacts already, then there's nothing for us to do.
  if (
    contactsImported === undefined ||
    contactsImported ||
    !isImportPromptDismissed ||
    contactsPermissionStatus === 'denied'
  )
    return null

  return (
    <Kb.ClickableBox onClick={onImportContacts}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        alignItems="center"
        gap="small"
        style={styles.importContactsContainer}
      >
        <Kb.Box2 direction="vertical" style={styles.iconContactBookContainer}>
          <Kb.Icon type="iconfont-contact-book" color={Kb.Styles.globalColors.black} />
        </Kb.Box2>
        <Kb.Text type="BodyBig" lineClamp={1}>
          Import phone contacts
        </Kb.Text>
        <Kb.Icon type="iconfont-arrow-right" sizeType="Small" color={Kb.Styles.globalColors.black} />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      banner: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blue,
          paddingBottom: Kb.Styles.globalMargins.xtiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.xtiny,
        },
        isMobile: {zIndex: -1}, // behind ServiceTabBar
      }),
      bannerButtonContainer: {
        alignSelf: 'flex-start',
        flexWrap: 'wrap',
        marginBottom: Kb.Styles.globalMargins.tiny,
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      bannerIcon: {
        marginLeft: Kb.Styles.globalMargins.xtiny,
        marginRight: Kb.Styles.globalMargins.xsmall,
        maxHeight: 112,
      },
      bannerText: {
        flexWrap: 'wrap',
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      iconContactBookContainer: {
        alignItems: 'center',
        marginLeft: Kb.Styles.globalMargins.xsmall,
        width: 48,
      },
      importContactsButton: {
        marginBottom: Kb.Styles.globalMargins.tiny,
      },
      importContactsContainer: {
        height: 64,
        justifyContent: 'flex-start',
      },
      primaryOnBlue: {backgroundColor: Kb.Styles.globalColors.white},
      primaryOnBlueLabel: {color: Kb.Styles.globalColors.blueDark},
      secondaryOnBlue: Kb.Styles.platformStyles({
        common: {backgroundColor: Kb.Styles.globalColors.black_20},
        isMobile: {borderWidth: 0},
      }),
      secondaryOnBlueLabel: {color: Kb.Styles.globalColors.white},
    }) as const
)
