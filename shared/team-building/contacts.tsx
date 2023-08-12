import * as C from '../constants'
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as Constants from '../constants/team-building'
import type * as Types from '../constants/types/team-building'

const useContactsProps = () => {
  const contactsImported = C.useSettingsContactsState(s => s.importEnabled)
  const contactsPermissionStatus = C.useSettingsContactsState(s => s.permissionStatus)
  const isImportPromptDismissed = C.useSettingsContactsState(s => s.importPromptDismissed)
  const numContactsImported = C.useSettingsContactsState(s => s.importedCount || 0)

  const importContactsLater = C.useSettingsContactsState(s => s.dispatch.importContactsLater)
  const loadContactImportEnabled = C.useSettingsContactsState(s => s.dispatch.loadContactImportEnabled)
  const editContactImportEnabled = C.useSettingsContactsState(s => s.dispatch.editContactImportEnabled)
  const requestPermissions = C.useSettingsContactsState(s => s.dispatch.requestPermissions)

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
  namespace: Types.AllowedNamespace
  selectedService: Types.ServiceIdWithContact
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

  const fetchUserRecs = Constants.useContext(s => s.dispatch.fetchUserRecs)
  const onRedoRecs = fetchUserRecs
  const prevNumContactsImported = Container.usePrevious(numContactsImported)

  // Redo search if # of imported contacts changes
  React.useEffect(() => {
    if (prevNumContactsImported !== undefined && prevNumContactsImported !== numContactsImported) {
      onRedoSearch()
      onRedoRecs()
    }
  }, [numContactsImported, prevNumContactsImported, onRedoSearch, onRedoRecs])

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
          <Kb.Icon type="iconfont-contact-book" color={Styles.globalColors.black} />
        </Kb.Box2>
        <Kb.Text type="BodyBig" lineClamp={1}>
          Import phone contacts
        </Kb.Text>
        <Kb.Icon type="iconfont-arrow-right" sizeType="Small" color={Styles.globalColors.black} />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      banner: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.blue,
          paddingBottom: Styles.globalMargins.xtiny,
          paddingRight: Styles.globalMargins.tiny,
          paddingTop: Styles.globalMargins.xtiny,
        },
        isMobile: {zIndex: -1}, // behind ServiceTabBar
      }),
      bannerButtonContainer: {
        alignSelf: 'flex-start',
        flexWrap: 'wrap',
        marginBottom: Styles.globalMargins.tiny,
        marginTop: Styles.globalMargins.tiny,
      },
      bannerIcon: {
        marginLeft: Styles.globalMargins.xtiny,
        marginRight: Styles.globalMargins.xsmall,
        maxHeight: 112,
      },
      bannerText: {
        flexWrap: 'wrap',
        marginTop: Styles.globalMargins.tiny,
      },
      bannerTextContainer: {
        flex: 1,
        justifyContent: 'center',
      },
      iconContactBookContainer: {
        alignItems: 'center',
        marginLeft: Styles.globalMargins.xsmall,
        width: 48,
      },
      importContactsButton: {
        marginBottom: Styles.globalMargins.tiny,
      },
      importContactsContainer: {
        height: 64,
        justifyContent: 'flex-start',
      },
    }) as const
)
