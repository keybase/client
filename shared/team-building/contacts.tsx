import * as React from 'react'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as SettingsGen from '../actions/settings-gen'
import type * as Types from '../constants/types/team-building'

const useContactsProps = () => {
  const contactsImported = Container.useSelector(state => state.settings.contacts.importEnabled)
  const contactsPermissionStatus = Container.useSelector(state => state.settings.contacts.permissionStatus)
  const isImportPromptDismissed = Container.useSelector(
    state => state.settings.contacts.importPromptDismissed
  )
  const numContactsImported = Container.useSelector(state => state.settings.contacts.importedCount || 0)

  const dispatch = Container.useDispatch()

  const onAskForContactsLater = React.useCallback(() => {
    dispatch(SettingsGen.createImportContactsLater())
  }, [dispatch])

  const onLoadContactsSetting = React.useCallback(() => {
    dispatch(SettingsGen.createLoadContactImportEnabled())
  }, [dispatch])

  const onImportContactsPermissionsGranted = React.useCallback(() => {
    dispatch(SettingsGen.createEditContactImportEnabled({enable: true, fromSettings: false}))
  }, [dispatch])
  const onImportContactsPermissionsNotGranted = React.useCallback(() => {
    dispatch(SettingsGen.createRequestContactPermissions({fromSettings: false, thenToggleImportOn: true}))
  }, [dispatch])

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
  const {onRedoSearch, namespace, selectedService} = props
  const {
    contactsImported,
    contactsPermissionStatus,
    isImportPromptDismissed,
    numContactsImported,
    onAskForContactsLater,
    onImportContacts,
    onLoadContactsSetting,
  } = useContactsProps()

  const dispatch = Container.useDispatch()

  const onRedoRecs = React.useCallback(() => {
    dispatch(TeamBuildingGen.createFetchUserRecs({includeContacts: namespace === 'chat2', namespace}))
  }, [dispatch, namespace])
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
    } as const)
)
