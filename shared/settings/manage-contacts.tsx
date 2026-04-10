import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import logger from '@/logger'
import {SettingsSection} from './account'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {settingsFeedbackTab} from '@/constants/settings'
import {useConfigState} from '@/stores/config'
import {clearContactList, syncContactsToServer} from '@/util/contacts.native'
import {useWaitingState} from '@/stores/waiting'

const enabledDescription = 'Your phone contacts are being synced on this device.'
const disabledDescription = 'Import your phone contacts and start encrypted chats with your friends.'
type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unknown'

const ManageContacts = () => {
  const [error, setError] = React.useState('')
  const [importedCount, setImportedCount] = React.useState<number>()
  const [joinedContacts, setJoinedContacts] = React.useState<ReadonlyArray<T.RPCGen.ProcessedContact>>([])
  const [working, setWorking] = React.useState(false)
  const contactsState = useSettingsContactsState(
    C.useShallow(s => ({
      contactsImported: s.importEnabled,
      editContactImportEnabled: s.dispatch.editContactImportEnabled,
      loadContactImportEnabled: s.dispatch.loadContactImportEnabled,
      notifySyncSucceeded: s.dispatch.notifySyncSucceeded,
      requestPermissions: s.dispatch.requestPermissions,
      status: s.permissionStatus,
    }))
  )
  const {contactsImported, editContactImportEnabled, loadContactImportEnabled, notifySyncSucceeded} =
    contactsState
  const {requestPermissions, status} = contactsState
  const navigateAppend = C.Router2.navigateAppend
  const waiting = C.Waiting.useAnyWaiting(C.importContactsWaitingKey) || working

  React.useEffect(() => {
    if (contactsImported === undefined) {
      loadContactImportEnabled().catch(() => {})
    }
  }, [contactsImported, loadContactImportEnabled])

  const withWaiting = React.useCallback(async <R,>(fn: () => Promise<R>) => {
    const {decrement, increment} = useWaitingState.getState().dispatch
    increment(C.importContactsWaitingKey)
    setWorking(true)
    try {
      return await fn()
    } finally {
      setWorking(false)
      decrement(C.importContactsWaitingKey)
    }
  }, [])

  const onToggle = React.useCallback(async () => {
    try {
      setError('')
      if (contactsImported) {
        await withWaiting(async () => {
          await editContactImportEnabled(false)
          await clearContactList()
          notifySyncSucceeded()
        })
        setImportedCount(undefined)
        setJoinedContacts([])
        return
      }

      let effectiveStatus = status
      if (effectiveStatus !== 'granted') {
        effectiveStatus = await requestPermissions()
      }
      if (effectiveStatus !== 'granted') {
        return
      }

      const importResult = await withWaiting(async () => {
        await editContactImportEnabled(true)
        const result = await syncContactsToServer()
        notifySyncSucceeded(result.defaultCountryCode)
        return result
      })
      setImportedCount(importResult.importedCount)
      setJoinedContacts(importResult.resolved)
      if (importResult.resolved.length) {
        navigateAppend({
          name: 'settingsContactsJoined',
          params: {resolvedContacts: [...importResult.resolved]},
        })
      }
    } catch (_error) {
      const nextError = (_error as {message?: string}).message ?? 'Unknown error'
      logger.error('Error updating contacts import:', nextError)
      setImportedCount(undefined)
      setJoinedContacts([])
      setError(nextError)
    }
  }, [
    contactsImported,
    editContactImportEnabled,
    navigateAppend,
    notifySyncSucceeded,
    requestPermissions,
    status,
    withWaiting,
  ])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} relative={true}>
      <Kb.BoxGrow>
        <ManageContactsBanner
          contactsImported={contactsImported}
          error={error}
          importedCount={importedCount}
          joinedContacts={joinedContacts}
          status={status}
        />
        <SettingsSection>
          <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
            <Kb.Text type="Header">Phone contacts</Kb.Text>
            <Kb.Text type="BodySmall">
              {contactsImported && status === 'granted' ? enabledDescription : disabledDescription}
            </Kb.Text>
            <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
              <Kb.Button
                disabled={status === 'denied'}
                mode="Secondary"
                label={contactsImported && status === 'granted' ? 'Remove contacts' : 'Import phone contacts'}
                type={contactsImported && status === 'granted' ? 'Danger' : 'Default'}
                onClick={onToggle}
                small={true}
                waiting={waiting}
              />
            </Kb.ButtonBar>
          </Kb.Box2>
        </SettingsSection>
      </Kb.BoxGrow>
    </Kb.Box2>
  )
}

const ManageContactsBanner = (props: {
  contactsImported?: boolean
  error: string
  importedCount?: number
  joinedContacts: ReadonlyArray<T.RPCGen.ProcessedContact>
  status: PermissionStatus
}) => {
  const {contactsImported, error, importedCount, joinedContacts, status} = props
  const onOpenAppSettings = useConfigState(s => s.dispatch.defer.openAppSettings)
  const {appendNewChatBuilder, navigateAppend, switchTab} = C.Router2
  const onStartChat = () => {
    switchTab(C.Tabs.chatTab)
    appendNewChatBuilder()
  }
  const onSendFeedback = () => {
    navigateAppend({
      name: settingsFeedbackTab,
      params: {feedback: `Contact import failed\n${error}\n\n`},
    })
  }
  const onViewJoinedContacts = () => {
    navigateAppend({
      name: 'settingsContactsJoined',
      params: {resolvedContacts: [...joinedContacts]},
    })
  }

  return (
    <>
      {!!importedCount && (
        <Kb.Banner color="green">
          <Kb.BannerParagraph bannerColor="green" content={[`You imported ${importedCount} contacts.`]} />
          <Kb.BannerParagraph
            bannerColor="green"
            content={[
              {onClick: onStartChat, text: 'Start a chat'},
              ...(joinedContacts.length
                ? [' or ', {onClick: onViewJoinedContacts, text: 'view contacts on Keybase'}]
                : []),
            ]}
          />
        </Kb.Banner>
      )}
      {(status === 'denied' || (Kb.Styles.isAndroid && status !== 'granted' && contactsImported)) && (
        <Kb.Banner color="red">
          <Kb.BannerParagraph
            bannerColor="red"
            content={[
              contactsImported
                ? "Contact importing is paused because Keybase doesn't have permission to access your contacts. "
                : "Keybase doesn't have permission to access your contacts. ",
              {onClick: onOpenAppSettings, text: 'Enable in settings'},
              '.',
            ]}
          />
        </Kb.Banner>
      )}
      {!!error && (
        <Kb.Banner color="red">
          <Kb.BannerParagraph bannerColor="red" content="There was an error importing your contacts." />
          <Kb.BannerParagraph
            bannerColor="red"
            content={[{onClick: onSendFeedback, text: 'Send us feedback.'}]}
          />
        </Kb.Banner>
      )}
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      buttonBar: {
        marginTop: Kb.Styles.globalMargins.tiny,
        minHeight: undefined,
        width: undefined,
      },
    }) as const
)

export default ManageContacts
