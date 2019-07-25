import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as SettingsGen from '../actions/settings-gen'
import TeamBox from './team-box'
import ServiceTabBar from './service-tab-bar'
import UserResult from './user-result'
import Flags from '../util/feature-flags'
import {serviceIdToAccentColor, serviceIdToIconFont, serviceIdToLabel} from './shared'
import {ServiceIdWithContact, FollowingState} from '../constants/types/team-building'
import {Props as OriginalRolePickerProps} from '../teams/role-picker'
import {TeamRoleType} from '../constants/types/teams'

type SearchResult = {
  userId: string
  username: string
  prettyName: string
  displayLabel: string
  services: {[K in ServiceIdWithContact]?: string}
  inTeam: boolean
  isPreExistingTeamMember: boolean
  followingState: FollowingState
}

export type RolePickerProps = {
  onSelectRole: (role: TeamRoleType) => void
  sendNotification: boolean
  changeSendNotification: (sendNotification: boolean) => void
  showRolePicker: boolean
  changeShowRolePicker: (showRolePicker: boolean) => void
  selectedRole: TeamRoleType
  disabledRoles: OriginalRolePickerProps['disabledRoles']
}

type Props = {
  fetchUserRecs: () => void
  highlightedIndex: number | null
  onAdd: (userId: string) => void
  onBackspace: () => void
  onChangeService: (newService: ServiceIdWithContact) => void
  onChangeText: (newText: string) => void
  onDownArrowKeyDown: () => void
  onEnterKeyDown: () => void
  onFinishTeamBuilding: () => void
  onMakeItATeam: () => void
  onRemove: (userId: string) => void
  onSearchForMore: () => void
  onUpArrowKeyDown: () => void
  recommendations: Array<SearchResult> | null
  searchResults: Array<SearchResult> | null
  searchString: string
  selectedService: ServiceIdWithContact
  serviceResultCount: {[K in ServiceIdWithContact]?: number | null}
  showRecs: boolean
  showServiceResultCount: boolean
  teamSoFar: Array<{
    userId: string
    prettyName: string
    service: ServiceIdWithContact
    username: string
  }>
  waitingForCreate: boolean
  rolePickerProps?: RolePickerProps
}

const ContactsBanner = ({onRedoSearch}: {onRedoSearch: () => void}) => {
  const dispatch = Container.useDispatch()

  const contactsImported = Container.useSelector(s => s.settings.contacts.importEnabled)
  const arePermissionsGranted = Container.useSelector(s => s.settings.contacts.permissionStatus)
  const isImportPromptDismissed = Container.useSelector(s => s.settings.contacts.importPromptDismissed)
  const numContactsImported = Container.useSelector(s => s.settings.contacts.importedCount)
  const prevNumContactsImported = Container.usePrevious(numContactsImported)
  // Although we won't use this if we early exit after subsequent checks, React
  // won't let us use hooks unless the execution is the same every time.
  const onImportContacts = React.useCallback(
    () =>
      dispatch(
        arePermissionsGranted !== 'granted'
          ? SettingsGen.createRequestContactPermissions({thenToggleImportOn: true})
          : SettingsGen.createEditContactImportEnabled({enable: true})
      ),
    [dispatch, arePermissionsGranted]
  )
  const onLater = React.useCallback(() => dispatch(SettingsGen.createImportContactsLater()), [dispatch])
  // Redo search if # of imported contacts changes
  React.useEffect(() => {
    if (prevNumContactsImported !== undefined && prevNumContactsImported !== numContactsImported) {
      onRedoSearch()
    }
  }, [numContactsImported, prevNumContactsImported, onRedoSearch])

  // Ensure that we know whether contacts are loaded, and if not, that we load
  // the current config setting.
  if (contactsImported === null) {
    dispatch(SettingsGen.createLoadContactImportEnabled())
    return null
  }
  // If we've imported contacts already, or the user has dismissed the message,
  // then there's nothing for us to do.
  if (contactsImported || isImportPromptDismissed || arePermissionsGranted === 'never_ask_again') return null

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.banner}>
      <Kb.Icon type="icon-fancy-user-card-mobile-120-149" style={styles.bannerIcon} />
      <Kb.Box2 direction="vertical" style={styles.bannerTextContainer}>
        <Kb.Text type="BodyBig" negative={true} style={styles.bannerText}>
          Import your phone contacts and start encrypted chats with your friends.
        </Kb.Text>
        <Kb.Box2 direction="horizontal" style={styles.bannerButtonContainer}>
          <Kb.Button
            label="Import contacts"
            backgroundColor="blue"
            onClick={onImportContacts}
            style={styles.bannerImportButton}
            small={true}
          />
          <Kb.Button
            label="Later"
            backgroundColor="blue"
            mode="Secondary"
            onClick={onLater}
            style={styles.bannerLaterButton}
            small={true}
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

class TeamBuilding extends React.PureComponent<Props, {}> {
  componentDidMount = () => {
    this.props.fetchUserRecs()
  }

  render = () => {
    const props = this.props
    const showRecPending = !props.searchString && !props.recommendations
    const showLoading = !!props.searchString && !props.searchResults
    const showRecs = props.showRecs
    return (
      <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
        {Styles.isMobile ? (
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <TeamBox
              onChangeText={props.onChangeText}
              onDownArrowKeyDown={props.onDownArrowKeyDown}
              onUpArrowKeyDown={props.onUpArrowKeyDown}
              onEnterKeyDown={props.onEnterKeyDown}
              onFinishTeamBuilding={props.onFinishTeamBuilding}
              onRemove={props.onRemove}
              teamSoFar={props.teamSoFar}
              onBackspace={props.onBackspace}
              searchString={props.searchString}
              rolePickerProps={props.rolePickerProps}
            />
          </Kb.Box2>
        ) : (
          <TeamBox
            onChangeText={props.onChangeText}
            onDownArrowKeyDown={props.onDownArrowKeyDown}
            onUpArrowKeyDown={props.onUpArrowKeyDown}
            onEnterKeyDown={props.onEnterKeyDown}
            onFinishTeamBuilding={props.onFinishTeamBuilding}
            onRemove={props.onRemove}
            teamSoFar={props.teamSoFar}
            onBackspace={props.onBackspace}
            searchString={props.searchString}
            rolePickerProps={props.rolePickerProps}
          />
        )}
        {!!props.teamSoFar.length && Flags.newTeamBuildingForChatAllowMakeTeam && (
          <Kb.Text type="BodySmall">
            Add up to 14 more people. Need more?
            <Kb.Text type="BodySmallPrimaryLink" onClick={props.onMakeItATeam}>
              {' '}
              Make it a team.
            </Kb.Text>
          </Kb.Text>
        )}
        <ServiceTabBar
          selectedService={props.selectedService}
          onChangeService={props.onChangeService}
          serviceResultCount={props.serviceResultCount}
          showServiceResultCount={props.showServiceResultCount}
        />
        {Flags.sbsContacts && Styles.isMobile && (
          <ContactsBanner onRedoSearch={() => props.onChangeText(props.searchString)} />
        )}
        {showRecPending || showLoading ? (
          <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" style={styles.loadingContainer}>
            <Kb.Icon
              style={Kb.iconCastPlatformStyles(styles.loadingIcon)}
              type="icon-progress-grey-animated"
            />
            <Kb.Text type="BodySmallSemibold">Loading</Kb.Text>
          </Kb.Box2>
        ) : !showRecs && !props.showServiceResultCount && !!props.selectedService ? (
          <Kb.Box2
            alignSelf="center"
            centerChildren={true}
            direction="vertical"
            fullHeight={true}
            fullWidth={true}
            gap="tiny"
            style={styles.emptyContainer}
          >
            <Kb.Icon
              fontSize={Styles.isMobile ? 48 : 64}
              type={serviceIdToIconFont(props.selectedService)}
              style={Styles.collapseStyles([
                !!props.selectedService && {color: serviceIdToAccentColor(props.selectedService)},
              ])}
            />
            <Kb.Text center={true} type="BodyBig">
              Enter a {serviceIdToLabel(props.selectedService)} username above.
            </Kb.Text>
            <Kb.Text center={true} type="BodySmall">
              Start a Keybase chat with anyone on {serviceIdToLabel(props.selectedService)}, even if they
              don’t have a Keybase account.
            </Kb.Text>
          </Kb.Box2>
        ) : (
          <Kb.List
            items={showRecs ? props.recommendations || [] : props.searchResults || []}
            selectedIndex={props.highlightedIndex || 0}
            style={styles.list}
            contentContainerStyle={styles.listContentContainer}
            keyProperty={'key'}
            onEndReached={props.onSearchForMore}
            renderItem={(index, result) => (
              <UserResult
                resultForService={props.selectedService}
                fixedHeight={400}
                username={result.username}
                prettyName={result.prettyName}
                displayLabel={result.displayLabel}
                services={result.services}
                inTeam={result.inTeam}
                isPreExistingTeamMember={result.isPreExistingTeamMember}
                followingState={result.followingState}
                highlight={!Styles.isMobile && index === props.highlightedIndex}
                onAdd={() => props.onAdd(result.userId)}
                onRemove={() => props.onRemove(result.userId)}
              />
            )}
          />
        )}
        {props.waitingForCreate && (
          <Kb.Box2 direction="vertical" style={styles.waiting} alignItems="center">
            <Kb.ProgressIndicator type="Small" white={true} style={styles.waitingProgress} />
          </Kb.Box2>
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  banner: {
    backgroundColor: Styles.globalColors.blue,
    padding: Styles.globalMargins.tiny,
  },
  bannerButtonContainer: {
    flexWrap: 'wrap',
    marginBottom: Styles.globalMargins.xsmall,
    marginTop: Styles.globalMargins.xsmall,
  },
  bannerIcon: {
    maxHeight: 112,
  },
  bannerImportButton: {
    marginBottom: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.small,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  bannerLaterButton: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  bannerText: {
    flexWrap: 'wrap',
    marginTop: Styles.globalMargins.xsmall,
  },
  bannerTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  container: Styles.platformStyles({
    common: {
      flex: 1,
      minHeight: 200,
      position: 'relative',
    },
    isElectron: {
      borderRadius: 4,
      height: 434,
      overflow: 'hidden',
      width: 470,
    },
  }),
  emptyContainer: Styles.platformStyles({
    common: {
      flex: 1,
    },
    isElectron: {
      maxWidth: 290,
      paddingBottom: 40,
    },
    isMobile: {
      maxWidth: '80%',
    },
  }),
  list: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.small,
    },
    isElectron: {
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
    },
  }),
  listContentContainer: Styles.platformStyles({
    isMobile: {
      paddingTop: Styles.globalMargins.xtiny,
    },
  }),
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingIcon: Styles.platformStyles({
    isElectron: {
      height: 32,
      width: 32,
    },
    isMobile: {
      height: 48,
      width: 48,
    },
  }),
  mobileFlex: Styles.platformStyles({
    isMobile: {flex: 1},
  }),
  waiting: {
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.black_20,
  },
  waitingProgress: {
    height: 48,
    width: 48,
  },
})

export default TeamBuilding
