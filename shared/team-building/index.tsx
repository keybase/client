import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as Constants from '../constants/team-building'
import TeamBox from './team-box'
import Input from './input'
import {ServiceTabBar} from './service-tab-bar'
import Flags from '../util/feature-flags'
import {Props as OriginalRolePickerProps} from '../teams/role-picker'
import {TeamRoleType} from '../constants/types/teams'
import {memoize} from '../util/memoize'
import throttle from 'lodash/throttle'
import PhoneSearch from './phone-search'
import AlphabetIndex from './alphabet-index'
import EmailSearch from './email-search'
import PeopleResult from './search-result/people-result'
import UserResult from './search-result/user-result'
import {userResultHeight} from './search-result/common-result'
import {
  serviceIdToAccentColor,
  serviceIdToIconFont,
  serviceIdToLabel,
  serviceIdToSearchPlaceholder,
} from './shared'
import {
  AllowedNamespace,
  FollowingState,
  GoButtonLabel,
  SearchResults,
  SelectedUser,
  ServiceIdWithContact,
} from '../constants/types/team-building'

export const numSectionLabel = '0-9'

export type SearchResult = {
  contact: boolean
  userId: string
  username: string
  prettyName: string
  displayLabel: string
  services: {[K in ServiceIdWithContact]?: string}
  inTeam: boolean
  isPreExistingTeamMember: boolean
  isYou: boolean
  followingState: FollowingState
}

export type ImportContactsEntry = {
  isImportButton: true
}

export type SearchHintEntry = {
  isSearchHint: true
}

export type ResultData = SearchResult | ImportContactsEntry | SearchHintEntry

export type SearchRecSection = {
  label: string
  shortcut: boolean
  data: Array<ResultData>
}

const isImportContactsEntry = (x: ResultData): x is ImportContactsEntry =>
  'isImportButton' in x && x.isImportButton

const isSearchHintEntry = (x: ResultData): x is SearchHintEntry => 'isSearchHint' in x && x.isSearchHint

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
  contactsImported: boolean | undefined
  contactsPermissionStatus: string
  isImportPromptDismissed: boolean
  numContactsImported: number
  onAskForContactsLater: () => void
  onImportContacts: (() => void) | undefined
  onLoadContactsSetting: () => void
  selectedService: ServiceIdWithContact
}

export type Props = ContactProps & {
  error?: string
  fetchUserRecs: () => void
  filterServices?: Array<ServiceIdWithContact>
  focusInputCounter: number
  goButtonLabel?: GoButtonLabel
  recommendedHideYourself?: boolean
  highlightedIndex: number | null
  includeContacts: boolean
  namespace: AllowedNamespace
  onAdd: (userId: string) => void
  onBackspace: () => void
  onChangeService: (newService: ServiceIdWithContact) => void
  onChangeText: (newText: string) => void
  onClear: () => void
  onClose: () => void
  onDownArrowKeyDown: () => void
  onEnterKeyDown: () => void
  onFinishTeamBuilding: () => void
  onMakeItATeam: () => void
  onRemove: (userId: string) => void
  onSearchForMore: () => void
  onUpArrowKeyDown: () => void
  recommendations: Array<SearchRecSection> | null
  rolePickerProps?: RolePickerProps
  search: (query: string, service: ServiceIdWithContact) => void
  searchResults: Array<SearchResult> | undefined
  searchString: string
  serviceResultCount: {[K in ServiceIdWithContact]?: number | null}
  showRecs: boolean
  showResults: boolean
  showServiceResultCount: boolean
  teamBuildingSearchResults: SearchResults
  teamSoFar: Array<SelectedUser>
  teamname: string | undefined
  title: string
  waitingForCreate: boolean
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
    if (props.contactsImported === undefined) {
      props.onLoadContactsSetting()
    }
  }, [props, props.contactsImported, props.onLoadContactsSetting])

  // If we've imported contacts already, or the user has dismissed the message,
  // then there's nothing for us to do.
  if (
    props.contactsImported === undefined ||
    props.selectedService !== 'keybase' ||
    props.contactsImported ||
    props.isImportPromptDismissed ||
    props.contactsPermissionStatus === 'never_ask_again' ||
    !props.onImportContacts
  )
    return null

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.banner}>
      <Kb.Icon type="icon-fancy-user-card-mobile-120-149" style={styles.bannerIcon} />
      <Kb.Box2 direction="vertical" style={styles.bannerTextContainer}>
        <Kb.Text type="BodySmallSemibold" negative={true} style={styles.bannerText}>
          Import your phone contacts and start encrypted chats with your friends.
        </Kb.Text>
        <Kb.Box2 direction="horizontal" gap="tiny" style={styles.bannerButtonContainer}>
          <Kb.Button
            label="Import contacts"
            backgroundColor="blue"
            onClick={props.onImportContacts}
            small={true}
            style={styles.importContactsButton}
          />
          <Kb.Button
            label="Skip"
            backgroundColor="blue"
            mode="Secondary"
            onClick={props.onAskForContactsLater}
            small={true}
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const ContactsImportButton = (props: ContactProps) => {
  // If we've imported contacts already, then there's nothing for us to do.
  if (
    props.contactsImported === undefined ||
    props.contactsImported ||
    !props.isImportPromptDismissed ||
    props.contactsPermissionStatus === 'never_ask_again'
  )
    return null

  return (
    <Kb.ClickableBox onClick={props.onImportContacts}>
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
        <Kb.Icon type="iconfont-arrow-right" sizeType="Small" color={Styles.globalColors.black_20} />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const SearchHintText = () => (
  <Kb.Box2 direction="vertical" style={styles.searchHint}>
    <Kb.Text type="BodySmall" style={{textAlign: 'center'}}>
      Search anyone on Keybase by typing a username or a full name.
    </Kb.Text>
  </Kb.Box2>
)

const FilteredServiceTabBar = (
  props: Omit<React.ComponentPropsWithoutRef<typeof ServiceTabBar>, 'services'> & {
    filterServices?: Array<ServiceIdWithContact>
  }
) => {
  const services = React.useMemo(
    () =>
      props.filterServices
        ? Constants.allServices.filter(
            serviceId => props.filterServices && props.filterServices.includes(serviceId)
          )
        : Constants.allServices,
    [props.filterServices]
  )

  return services.length === 1 && services[0] === 'keybase' ? null : (
    <ServiceTabBar
      services={services}
      selectedService={props.selectedService}
      onChangeService={props.onChangeService}
      serviceResultCount={props.serviceResultCount}
      showServiceResultCount={props.showServiceResultCount}
      servicesShown={props.servicesShown}
      minimalBorder={props.minimalBorder}
      offset={props.offset}
    />
  )
}

const EmptyResultText = (props: {selectedService: ServiceIdWithContact; action: string}) => (
  <Kb.Box2
    alignSelf="center"
    centerChildren={!Styles.isMobile}
    direction="vertical"
    fullWidth={true}
    gap="tiny"
    style={styles.emptyContainer}
  >
    {!Styles.isMobile && (
      <Kb.Icon
        fontSize={Styles.isMobile ? 48 : 64}
        type={serviceIdToIconFont(props.selectedService)}
        style={Styles.collapseStyles([
          !!props.selectedService && {color: serviceIdToAccentColor(props.selectedService)},
        ])}
      />
    )}
    {!Styles.isMobile && (
      <Kb.Text center={true} type="BodyBig">
        Enter a {serviceIdToLabel(props.selectedService)} username above.
      </Kb.Text>
    )}
    <Kb.Text center={true} style={styles.emptyServiceText} type="BodySmall">
      {props.action} anyone on {serviceIdToLabel(props.selectedService)}, even if they don’t have a Keybase
      account.
    </Kb.Text>
  </Kb.Box2>
)

const SectionList = Styles.isMobile ? Kb.ReAnimated.createAnimatedComponent(Kb.SectionList) : Kb.SectionList

class TeamBuilding extends React.PureComponent<Props> {
  private offset: any = Styles.isMobile ? new Kb.ReAnimated.Value(0) : undefined

  sectionListRef = React.createRef<Kb.SectionList>()
  componentDidMount = () => {
    this.props.fetchUserRecs()
  }

  _alphabetIndex = () => {
    let showNumSection = false
    let labels: Array<string> = []
    if (this.props.recommendations && this.props.recommendations.length > 0) {
      showNumSection =
        this.props.recommendations[this.props.recommendations.length - 1].label === numSectionLabel
      labels = this.props.recommendations
        .filter(r => r.shortcut && r.label !== numSectionLabel)
        .map(r => r.label)
    }
    if (!labels.length) {
      return null
    }
    return (
      <>
        <AlphabetIndex
          labels={labels}
          showNumSection={showNumSection}
          onScroll={this._onScrollToSection}
          style={styles.alphabetIndex}
          measureKey={!!this.props.teamSoFar.length}
        />
      </>
    )
  }

  _onScrollToSection = (label: string) => {
    if (this.sectionListRef && this.sectionListRef.current) {
      const ref = this.sectionListRef.current
      const sectionIndex =
        (this.props.recommendations &&
          (label === 'numSection'
            ? this.props.recommendations.length - 1
            : this.props.recommendations.findIndex(section => section.label === label))) ||
        -1
      if (sectionIndex >= 0 && Styles.isMobile) {
        // @ts-ignore RN type not plumbed. see section-list.d.ts
        const node = ref.getNode()
        node &&
          node.scrollToLocation({
            animated: false,
            itemIndex: 0,
            sectionIndex,
          })
      }
    }
  }

  _getRecLayout = (
    sections: Array<SearchRecSection>,
    indexInList: number
  ): {index: number; length: number; offset: number} => {
    const sectionDividerHeight = Kb.SectionDivider.height
    const dataRowHeight = userResultHeight

    let numSections = 0
    let numData = 0
    let length = dataRowHeight
    let currSectionHeaderIdx = 0
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i]
      if (indexInList === currSectionHeaderIdx) {
        // we are the section header
        length = Kb.SectionDivider.height
        break
      }
      numSections++
      const indexInSection = indexInList - currSectionHeaderIdx - 1
      if (indexInSection === s.data.length) {
        // it's the section footer (we don't render footers so 0px).
        numData += s.data.length
        length = 0
        break
      }
      if (indexInSection < s.data.length) {
        // we are in this data
        numData += indexInSection
        break
      }
      // we're not in this section
      numData += s.data.length
      currSectionHeaderIdx += s.data.length + 2 // +2 because footer
    }
    const offset = numSections * sectionDividerHeight + numData * dataRowHeight
    return {index: indexInList, length, offset}
  }

  _listIndexToSectionAndLocalIndex = memoize(
    (
      highlightedIndex: number | null,
      sections: SearchRecSection[] | null
    ): {index: number; section: SearchRecSection} | null => {
      if (highlightedIndex !== null && sections !== null) {
        let index = highlightedIndex
        for (const section of sections) {
          if (index >= section.data.length) {
            index -= section.data.length
          } else {
            return {index, section}
          }
        }
      }
      return null
    }
  )

  _searchInput = () => (
    <Input
      onChangeText={this.props.onChangeText}
      onClear={
        this.props.namespace === 'people' && !this.props.searchString
          ? this.props.onClose
          : this.props.onClear
      }
      onDownArrowKeyDown={this.props.onDownArrowKeyDown}
      onUpArrowKeyDown={this.props.onUpArrowKeyDown}
      onEnterKeyDown={this.props.onEnterKeyDown}
      onBackspace={this.props.onBackspace}
      placeholder={'Search ' + serviceIdToSearchPlaceholder(this.props.selectedService)}
      searchString={this.props.searchString}
      focusOnMount={!Styles.isMobile || this.props.selectedService !== 'keybase'}
      focusCounter={this.props.focusInputCounter}
    />
  )

  _listBody = () => {
    const ResultRow = this.props.namespace === 'people' ? PeopleResult : UserResult
    const showRecPending =
      !this.props.searchString && !this.props.recommendations && this.props.selectedService === 'keybase'
    const showLoading = !!this.props.searchString && !this.props.searchResults
    if (showRecPending || showLoading) {
      return (
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          gap="xtiny"
          centerChildren={true}
          style={styles.loadingContainer}
        >
          {showLoading && <Kb.Animation animationType="spinner" style={styles.loadingAnimation} />}
        </Kb.Box2>
      )
    }
    if (!this.props.showRecs && !this.props.showResults && !!this.props.selectedService) {
      if (this.props.namespace === 'people') {
        return <EmptyResultText selectedService={this.props.selectedService} action="Search for" />
      } else {
        return (
          <EmptyResultText selectedService={this.props.selectedService} action="Start a Keybase chat with" />
        )
      }
    }
    if (this.props.showRecs && this.props.recommendations) {
      const highlightDetails = this._listIndexToSectionAndLocalIndex(
        this.props.highlightedIndex,
        this.props.recommendations
      )
      return (
        <Kb.BoxGrow>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.listContainer}>
            <SectionList
              ref={this.sectionListRef}
              contentContainerStyle={{minHeight: '133%'}}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              stickySectionHeadersEnabled={false}
              scrollEventThrottle={1}
              onScroll={this.onScroll}
              selectedIndex={Styles.isMobile ? undefined : this.props.highlightedIndex || 0}
              sections={this.props.recommendations}
              keyExtractor={(item: ResultData, index: number) => {
                if (!isImportContactsEntry(item) && !isSearchHintEntry(item) && item.contact) {
                  // Ids for contacts are not guaranteed to be unique
                  return item.userId + index
                }
                return isImportContactsEntry(item)
                  ? 'Import Contacts'
                  : isSearchHintEntry(item)
                  ? 'New User Search Hint'
                  : item.userId
              }}
              getItemLayout={this._getRecLayout}
              renderItem={({index, item: result, section}: any) =>
                result.isImportButton ? (
                  <ContactsImportButton {...this.props} />
                ) : result.isSearchHint ? (
                  <SearchHintText />
                ) : this.props.recommendedHideYourself && result.isYou ? null : (
                  <ResultRow
                    namespace={this.props.namespace}
                    resultForService={this.props.selectedService}
                    username={result.username}
                    prettyName={result.prettyName}
                    displayLabel={result.displayLabel}
                    services={result.services}
                    inTeam={result.inTeam}
                    isPreExistingTeamMember={result.isPreExistingTeamMember}
                    isYou={result.isYou}
                    followingState={result.followingState}
                    highlight={
                      !Styles.isMobile &&
                      !!highlightDetails &&
                      this.props.namespace !== 'people' &&
                      highlightDetails.section === section &&
                      highlightDetails.index === index
                    }
                    onAdd={() => this.props.onAdd(result.userId)}
                    onRemove={() => this.props.onRemove(result.userId)}
                  />
                )
              }
              renderSectionHeader={({section: {label}}: any) =>
                label && (!Styles.isMobile || label !== 'Recommendations') ? (
                  <Kb.SectionDivider label={label} />
                ) : null
              }
            />
            {Styles.isMobile && this._alphabetIndex()}
          </Kb.Box2>
        </Kb.BoxGrow>
      )
    }

    return (
      <>
        {this.props.searchResults === undefined || this.props.searchResults?.length ? (
          <Kb.List
            reAnimated={true}
            items={this.props.searchResults || []}
            onScroll={this.onScroll}
            selectedIndex={this.props.highlightedIndex || 0}
            style={styles.list}
            contentContainerStyle={styles.listContentContainer}
            keyboardShouldPersistTaps="handled"
            keyProperty="key"
            onEndReached={this._onEndReached}
            onEndReachedThreshold={0.1}
            renderItem={(index, result) => (
              <ResultRow
                key={result.username}
                resultForService={this.props.selectedService}
                username={result.username}
                prettyName={result.prettyName}
                displayLabel={result.displayLabel}
                services={result.services}
                namespace={this.props.namespace}
                inTeam={result.inTeam}
                isPreExistingTeamMember={result.isPreExistingTeamMember}
                isYou={result.isYou}
                followingState={result.followingState}
                highlight={!Styles.isMobile && index === this.props.highlightedIndex}
                onAdd={() => this.props.onAdd(result.userId)}
                onRemove={() => this.props.onRemove(result.userId)}
              />
            )}
          />
        ) : (
          <Kb.Text type="BodySmall" style={styles.noResults}>
            No results were found
          </Kb.Text>
        )}
      </>
    )
  }

  _onEndReached = throttle(() => {
    this.props.onSearchForMore()
  }, 500)

  onScroll = Styles.isMobile
    ? Kb.ReAnimated.event([{nativeEvent: {contentOffset: {y: this.offset}}}], {useNativeDriver: true})
    : undefined

  render() {
    const props = this.props

    let content: React.ReactNode
    switch (props.selectedService) {
      case 'email':
        content = (
          <EmailSearch
            continueLabel={props.teamSoFar.length > 0 ? 'Add' : 'Continue'}
            namespace={props.namespace}
            teamBuildingSearchResults={props.teamBuildingSearchResults}
            search={props.search}
          />
        )
        break
      case 'phone':
        content = (
          <PhoneSearch
            continueLabel={props.teamSoFar.length > 0 ? 'Add' : 'Continue'}
            namespace={props.namespace}
            search={props.search}
            teamBuildingSearchResults={props.teamBuildingSearchResults}
          />
        )
        break
      default:
        content = (
          <>
            {this._searchInput()}
            {props.namespace === 'people' && !Styles.isMobile && (
              <FilteredServiceTabBar
                filterServices={props.filterServices}
                selectedService={props.selectedService}
                onChangeService={props.onChangeService}
                serviceResultCount={props.serviceResultCount}
                showServiceResultCount={props.showServiceResultCount}
                servicesShown={5} // wider bar, show more services
                minimalBorder={true} // only show bottom border on icon when active
                offset={1}
              />
            )}
            {this._listBody()}
            {props.waitingForCreate && (
              <Kb.Box2 direction="vertical" style={styles.waiting} alignItems="center">
                <Kb.ProgressIndicator type="Small" white={true} style={styles.waitingProgress} />
              </Kb.Box2>
            )}
          </>
        )
    }
    const teamBox = !!props.teamSoFar.length && (
      <TeamBox
        allowPhoneEmail={props.selectedService === 'keybase' && props.includeContacts}
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
        goButtonLabel={props.goButtonLabel}
      />
    )

    // Handle when team-building is making a new chat v.s. adding members to a team.
    const chatHeader =
      props.namespace === 'people' ? null : props.rolePickerProps ? (
        <Kb.Box2 direction="vertical" alignItems="center" style={styles.headerContainer}>
          <Kb.Avatar teamname={props.teamname} size={32} style={styles.teamAvatar} />
          <Kb.Text type="Header">{props.title}</Kb.Text>
          <Kb.Text type="BodyTiny">Add as many members as you would like.</Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Box2 direction="vertical" alignItems="center">
          <Kb.Text type="Header" style={styles.newChatHeader}>
            {props.title}
          </Kb.Text>
        </Kb.Box2>
      )

    // If there are no filterServices or if the filterServices has a phone
    const showContactsBanner =
      Styles.isMobile && (!props.filterServices || props.filterServices.includes('phone'))

    const containerStyle = Styles.collapseStyles([
      styles.container,
      props.namespace !== 'people' ? styles.fixedWidthContainer : null,
    ])

    return (
      <Kb.Box2 direction="vertical" style={containerStyle} fullWidth={true}>
        {Styles.isMobile ? null : chatHeader}
        {teamBox &&
          (Styles.isMobile ? (
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              {teamBox}
            </Kb.Box2>
          ) : (
            teamBox
          ))}
        {!!props.error && <Kb.Banner color="red">{props.error}</Kb.Banner>}
        {!!props.teamSoFar.length && Flags.newTeamBuildingForChatAllowMakeTeam && (
          <Kb.Text type="BodySmall">
            Add up to 14 more people. Need more?
            <Kb.Text type="BodySmallPrimaryLink" onClick={props.onMakeItATeam}>
              {' '}
              Make it a team.
            </Kb.Text>
          </Kb.Text>
        )}
        {(props.namespace !== 'people' || Styles.isMobile) && (
          <FilteredServiceTabBar
            filterServices={props.filterServices}
            selectedService={props.selectedService}
            onChangeService={props.onChangeService}
            serviceResultCount={props.serviceResultCount}
            showServiceResultCount={props.showServiceResultCount}
            offset={this.offset}
          />
        )}
        {showContactsBanner && (
          <ContactsBanner
            {...props}
            onRedoSearch={() => props.onChangeText(props.searchString)}
            onRedoRecs={props.fetchUserRecs}
          />
        )}
        {content}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      alphabetIndex: {
        maxHeight: '80%',
        position: 'absolute',
        right: 0,
        top: Styles.globalMargins.large,
      },
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
      bannerIcon: {maxHeight: 112},
      bannerText: {
        flexWrap: 'wrap',
        marginTop: Styles.globalMargins.tiny,
      },
      bannerTextContainer: {
        flex: 1,
        justifyContent: 'center',
      },
      container: Styles.platformStyles({
        common: {
          position: 'relative',
        },
        isElectron: {
          borderRadius: 4,
          flex: 1,
          height: 560,
          maxHeight: 560,
          minHeight: 200,
          overflow: 'visible',
        },
        isMobile: {
          flexGrow: 1,
          height: '100%',
        },
      }),
      emptyContainer: Styles.platformStyles({
        common: {flex: 1},
        isElectron: {
          maxWidth: 290,
          paddingBottom: 40,
        },
        isMobile: {maxWidth: '80%'},
      }),
      emptyServiceText: Styles.platformStyles({
        isMobile: {
          padding: Styles.globalMargins.small,
        },
      }),
      fixedWidthContainer: Styles.platformStyles({
        isElectron: {
          width: 400,
        },
      }),
      headerContainer: Styles.platformStyles({
        isElectron: {
          marginBottom: Styles.globalMargins.xtiny,
          marginTop: Styles.globalMargins.small + 2,
        },
      }),
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
      list: Styles.platformStyles({
        common: {paddingBottom: Styles.globalMargins.small},
      }),
      listContainer: Styles.platformStyles({
        common: {
          position: 'relative',
        },
        isElectron: {flex: 1, height: '100%', overflow: 'hidden'},
        isMobile: {
          flexGrow: 1,
          width: '100%',
        },
      }),
      listContentContainer: Styles.platformStyles({
        isMobile: {paddingTop: Styles.globalMargins.xtiny},
      }),
      loadingAnimation: Styles.platformStyles({
        isElectron: {
          height: 32,
          width: 32,
        },
        isMobile: {
          height: 48,
          width: 48,
        },
      }),
      loadingContainer: {
        flex: 1,
        justifyContent: 'flex-start',
      },
      mobileFlex: Styles.platformStyles({
        isMobile: {flex: 1},
      }),
      newChatHeader: Styles.platformStyles({
        isElectron: {
          margin: Styles.globalMargins.xsmall,
        },
      }),
      noResults: {
        flex: 1,
        ...Styles.padding(Styles.globalMargins.small),
      },
      searchHint: {
        paddingLeft: Styles.globalMargins.xlarge,
        paddingRight: Styles.globalMargins.xlarge,
        paddingTop: Styles.globalMargins.xlarge,
      },
      shrinkingGap: {flexShrink: 1, height: Styles.globalMargins.xtiny},
      teamAvatar: Styles.platformStyles({
        isElectron: {
          alignSelf: 'center',
          position: 'absolute',
          top: -16,
        },
      }),
      waiting: {
        ...Styles.globalStyles.fillAbsolute,
        backgroundColor: Styles.globalColors.black_20,
      },
      waitingProgress: {
        height: 48,
        width: 48,
      },
    } as const)
)

export default TeamBuilding
