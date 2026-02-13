import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {useTBContext} from '@/stores/team-building'

const useContactsProps = () => {
  const contactsImported = useSettingsContactsState(s => s.importEnabled)
  const contactsPermissionStatus = useSettingsContactsState(s => s.permissionStatus)
  const isImportPromptDismissed = useSettingsContactsState(s => s.importPromptDismissed)
  const numContactsImported = useSettingsContactsState(s => s.importedCount || 0)

  const importContactsLater = useSettingsContactsState(s => s.dispatch.importContactsLater)
  const loadContactImportEnabled = useSettingsContactsState(s => s.dispatch.loadContactImportEnabled)
  const editContactImportEnabled = useSettingsContactsState(s => s.dispatch.editContactImportEnabled)
  const requestPermissions = useSettingsContactsState(s => s.dispatch.requestPermissions)

  const onAskForContactsLater = importContactsLater
  const onLoadContactsSetting = loadContactImportEnabled

  const onImportContactsPermissionsGranted = React.useCallback(() => {
    editContactImportEnabled(true, false)
  }, [editContactImportEnabled])
  const onImportContactsPermissionsNotGranted = React.useCallback(() => {
    requestPermissions(true, false)
  }, [requestPermissions])

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
      <Kb.Icon type="icon-fancy-contact-import-mobile-72-96" style={styles.bannerIcon} />
      <Kb.Box2 direction="vertical" style={styles.bannerTextContainer}>
        <Kb.Text type="BodySmallSemibold" negative={true} style={styles.bannerText}>
          Import your phone contacts and start encrypted chats with your friends.
        </Kb.Text>
        <Kb.Box2 direction="horizontal" gap="tiny" style={styles.bannerButtonContainer}>
          <Kb.Button
            label="Import contacts"
            backgroundColor="blue"
            onClick={onImportContacts}
            small={true}
            style={styles.importContactsButton}
          />
          <Kb.Button
            label="Skip"
            backgroundColor="blue"
            mode="Secondary"
            onClick={onAskForContactsLater}
            small={true}
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
      bannerTextContainer: {
        flex: 1,
        justifyContent: 'center',
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
    }) as const
)
