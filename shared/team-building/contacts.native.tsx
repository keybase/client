import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import logger from '@/logger'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {useTBContext} from '@/stores/team-building'
import {syncContactsToServer} from '@/util/contacts.native'

const useContactsProps = () => {
  const {
    contactsImported,
    contactsPermissionStatus,
    editContactImportEnabled,
    loadContactImportEnabled,
    notifySyncSucceeded,
    requestPermissions,
    syncGeneration,
  } = useSettingsContactsState(
    C.useShallow(s => ({
      contactsImported: s.importEnabled,
      contactsPermissionStatus: s.permissionStatus,
      editContactImportEnabled: s.dispatch.editContactImportEnabled,
      loadContactImportEnabled: s.dispatch.loadContactImportEnabled,
      notifySyncSucceeded: s.dispatch.notifySyncSucceeded,
      requestPermissions: s.dispatch.requestPermissions,
      syncGeneration: s.syncGeneration,
    }))
  )
  const {dismissContactsImportPrompt, isImportPromptDismissed} = useTBContext(
    C.useShallow(s => ({
      dismissContactsImportPrompt: s.dispatch.dismissContactsImportPrompt,
      isImportPromptDismissed: s.contactsImportPromptDismissed,
    }))
  )

  const onImportContacts = React.useCallback(async () => {
    try {
      const status =
        contactsPermissionStatus === 'granted' ? contactsPermissionStatus : await requestPermissions()
      if (status !== 'granted') {
        return
      }
      await editContactImportEnabled(true)
      const result = await syncContactsToServer()
      notifySyncSucceeded(result.defaultCountryCode)
    } catch (error) {
      logger.error('Error importing contacts from team building:', error)
    }
  }, [contactsPermissionStatus, editContactImportEnabled, notifySyncSucceeded, requestPermissions])

  return {
    contactsImported,
    contactsPermissionStatus,
    isImportPromptDismissed,
    onAskForContactsLater: dismissContactsImportPrompt,
    onImportContacts,
    onLoadContactsSetting: loadContactImportEnabled,
    syncGeneration,
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
    onAskForContactsLater,
    onImportContacts,
    onLoadContactsSetting,
    syncGeneration,
  } = useContactsProps()

  const fetchUserRecs = useTBContext(s => s.dispatch.fetchUserRecs)
  const prevSyncGenerationRef = React.useRef(syncGeneration)

  React.useEffect(() => {
    if (prevSyncGenerationRef.current !== syncGeneration) {
      prevSyncGenerationRef.current = syncGeneration
      onRedoSearch()
      fetchUserRecs()
    }
  }, [fetchUserRecs, onRedoSearch, syncGeneration])

  React.useEffect(() => {
    if (contactsImported === undefined) {
      onLoadContactsSetting().catch(() => {})
    }
  }, [contactsImported, onLoadContactsSetting])

  if (
    contactsImported === undefined ||
    selectedService !== 'keybase' ||
    contactsImported ||
    isImportPromptDismissed ||
    contactsPermissionStatus === 'denied'
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
