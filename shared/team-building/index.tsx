import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import * as Container from '../util/container'
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

export type SearchRecSection = {
  label: string
  shortcut: boolean
  data: Array<SearchResult>
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

type ContactProps = {
  contactsImported: boolean | null
  contactsPermissionStatus: string
  isImportPromptDismissed: boolean
  numContactsImported: number
  onAskForContactsLater: () => void
  onImportContacts: () => void
  onLoadContactsSetting: () => void
}

export type Props = ContactProps & {
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
  recommendations: Array<SearchRecSection> | null
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

const ContactsBanner = (props: ContactProps & {onRedoSearch: () => void; onRedoRecs: () => void}) => {
  const prevNumContactsImported = Container.usePrevious(props.numContactsImported)

  // Redo search if # of imported contacts changes
  React.useEffect(() => {
    if (prevNumContactsImported !== undefined && prevNumContactsImported !== props.numContactsImported) {
      props.onRedoSearch()
      props.onRedoRecs()
    }
  }, [props, props.numContactsImported, prevNumContactsImported, props.onRedoSearch, props.onRedoRecs])

  // Ensure that we know whether contacts are loaded, and if not, that we load
  // the current config setting.
  React.useEffect(() => {
    if (props.contactsImported === null) {
      props.onLoadContactsSetting()
    }
  }, [props, props.contactsImported, props.onLoadContactsSetting])

  // If we've imported contacts already, or the user has dismissed the message,
  // then there's nothing for us to do.
  if (
    props.contactsImported === null ||
    props.contactsImported ||
    props.isImportPromptDismissed ||
    props.contactsPermissionStatus === 'never_ask_again'
  )
    return null

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
            onClick={props.onImportContacts}
            style={styles.bannerImportButton}
            small={true}
          />
          <Kb.Button
            label="Later"
            backgroundColor="blue"
            mode="Secondary"
            onClick={props.onAskForContactsLater}
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

  _alphabetIndex = () => {
    return (
      <Kb.Text type="BodySmall" style={{position: 'absolute', right: 5, top: 5}}>
        A
      </Kb.Text>
    )
  }

  _listBody = () => {
    const showRecPending = !this.props.searchString && !this.props.recommendations
    const showLoading = !!this.props.searchString && !this.props.searchResults
    if (showRecPending || showLoading) {
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" style={styles.loadingContainer}>
          <Kb.Icon style={Kb.iconCastPlatformStyles(styles.loadingIcon)} type="icon-progress-grey-animated" />
          <Kb.Text type="BodySmallSemibold">Loading</Kb.Text>
        </Kb.Box2>
      )
    }
    if (!this.props.showRecs && !this.props.showServiceResultCount && !!this.props.selectedService) {
      return (
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
            type={serviceIdToIconFont(this.props.selectedService)}
            style={Styles.collapseStyles([
              !!this.props.selectedService && {color: serviceIdToAccentColor(this.props.selectedService)},
            ])}
          />
          <Kb.Text center={true} type="BodyBig">
            Enter a {serviceIdToLabel(this.props.selectedService)} username above.
          </Kb.Text>
          <Kb.Text center={true} type="BodySmall">
            Start a Keybase chat with anyone on {serviceIdToLabel(this.props.selectedService)}, even if they
            don’t have a Keybase account.
          </Kb.Text>
        </Kb.Box2>
      )
    }
    if (this.props.showRecs) {
      return (
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          style={Styles.collapseStyles([Styles.globalStyles.flexOne, {position: 'relative'}])}
        >
          <Kb.SectionList
            sections={this.props.recommendations}
            renderItem={({index, item: result}) => (
              <UserResult
                resultForService={this.props.selectedService}
                fixedHeight={400}
                username={result.username}
                prettyName={result.prettyName}
                displayLabel={result.displayLabel}
                services={result.services}
                inTeam={result.inTeam}
                isPreExistingTeamMember={result.isPreExistingTeamMember}
                followingState={result.followingState}
                highlight={!Styles.isMobile && index === this.props.highlightedIndex}
                onAdd={() => this.props.onAdd(result.userId)}
                onRemove={() => this.props.onRemove(result.userId)}
              />
            )}
            renderSectionHeader={({section: {label}}) => <Kb.SectionDivider label={label} />}
          />
          {this._alphabetIndex()}
        </Kb.Box2>
      )
    }
    return (
      <Kb.List
        items={this.props.searchResults || []}
        selectedIndex={this.props.highlightedIndex || 0}
        style={styles.list}
        contentContainerStyle={styles.listContentContainer}
        keyProperty={'key'}
        onEndReached={this.props.onSearchForMore}
        renderItem={(index, result) => (
          <UserResult
            resultForService={this.props.selectedService}
            fixedHeight={400}
            username={result.username}
            prettyName={result.prettyName}
            displayLabel={result.displayLabel}
            services={result.services}
            inTeam={result.inTeam}
            isPreExistingTeamMember={result.isPreExistingTeamMember}
            followingState={result.followingState}
            highlight={!Styles.isMobile && index === this.props.highlightedIndex}
            onAdd={() => this.props.onAdd(result.userId)}
            onRemove={() => this.props.onRemove(result.userId)}
          />
        )}
      />
    )
  }

  render = () => {
    const props = this.props
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
          <ContactsBanner
            {...props}
            onRedoSearch={() => props.onChangeText(props.searchString)}
            onRedoRecs={props.fetchUserRecs}
          />
        )}
        {this._listBody()}
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
