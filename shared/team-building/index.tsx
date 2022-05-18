import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as Constants from '../constants/team-building'
import * as TeamConstants from '../constants/teams'
import * as TeamBuildingGen from '../actions/team-building-gen'
import {ContactsImportButton, ContactsBanner} from './contacts'
import TeamBox from './team-box'
import Input from './input'
import {ServiceTabBar} from './service-tab-bar'
import type {Props as OriginalRolePickerProps} from '../teams/role-picker'
import {type TeamRoleType, type TeamID, noTeamID} from '../constants/types/teams'
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
import type {
  AllowedNamespace,
  FollowingState,
  GoButtonLabel,
  SearchResults,
  SelectedUser,
  ServiceIdWithContact,
} from '../constants/types/team-building'
import {ModalTitle as TeamsModalTitle} from '../teams/common'
import type {Section} from '../common-adapters/section-list'

export const numSectionLabel = '0-9'

export type SearchResult = {
  contact: boolean
  userId: string
  username: string
  prettyName: string
  pictureUrl?: string
  displayLabel: string
  services: {[K in ServiceIdWithContact]?: string}
  inTeam: boolean
  isPreExistingTeamMember: boolean
  isYou: boolean
  followingState: FollowingState
  isImportButton?: false
  isSearchHint?: false
}

export type ImportContactsEntry = {
  isImportButton: true
  isSearchHint?: false
}

export type SearchHintEntry = {
  isImportButton?: false
  isSearchHint: true
}

export type ResultData = SearchResult | ImportContactsEntry | SearchHintEntry

export type SearchRecSection = {
  label: string
  shortcut: boolean
  data: Array<ResultData>
}

const isImportContactsEntry = (x: ResultData): x is ImportContactsEntry =>
  'isImportButton' in x && !!x.isImportButton

const isSearchHintEntry = (x: ResultData): x is SearchHintEntry => 'isSearchHint' in x && !!x.isSearchHint

export type RolePickerProps = {
  onSelectRole: (role: TeamRoleType) => void
  sendNotification: boolean
  changeSendNotification: (sendNotification: boolean) => void
  showRolePicker: boolean
  changeShowRolePicker: (showRolePicker: boolean) => void
  selectedRole: TeamRoleType
  disabledRoles: OriginalRolePickerProps<false>['disabledRoles']
}

export type Props = {
  error?: string
  filterServices?: Array<ServiceIdWithContact>
  focusInputCounter: number
  goButtonLabel?: GoButtonLabel
  recommendedHideYourself?: boolean
  highlightedIndex: number | null
  includeContacts: boolean
  namespace: AllowedNamespace
  onAdd: (userId: string) => void
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
  selectedService: ServiceIdWithContact
  search: (query: string, service: ServiceIdWithContact) => void
  searchResults: Array<SearchResult> | undefined
  searchString: string
  serviceResultCount: {[K in ServiceIdWithContact]?: number | null}
  showRecs: boolean
  showResults: boolean
  showServiceResultCount: boolean
  teamBuildingSearchResults: SearchResults
  teamID: TeamID | undefined
  teamSoFar: Array<SelectedUser>
  teamname: string | undefined
  title: string
  waitingForCreate: boolean
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
  const {
    selectedService,
    onChangeService,
    serviceResultCount,
    showServiceResultCount,
    servicesShown,
    minimalBorder,
    offset,
    filterServices,
  } = props
  const services = React.useMemo(
    () =>
      filterServices
        ? Constants.allServices.filter(serviceId => filterServices?.includes(serviceId))
        : Constants.allServices,
    [filterServices]
  )

  return services.length === 1 && services[0] === 'keybase' ? null : (
    <ServiceTabBar
      services={services}
      selectedService={selectedService}
      onChangeService={onChangeService}
      serviceResultCount={serviceResultCount}
      showServiceResultCount={showServiceResultCount}
      servicesShown={servicesShown}
      minimalBorder={minimalBorder}
      offset={offset}
    />
  )
}

type SectionListProp = {
  sectionListRef: React.RefObject<Kb.SectionList<Section<ResultData, SearchRecSection>>>
}

type OnScrollProps = {
  onScroll: undefined | (() => void)
}

const TeamAlphabetIndex = (props: Pick<Props, 'recommendations' | 'teamSoFar'> & SectionListProp) => {
  const {recommendations, teamSoFar, sectionListRef} = props
  let showNumSection = false
  let labels: Array<string> = []
  if (recommendations && recommendations.length > 0) {
    showNumSection = recommendations[recommendations.length - 1].label === numSectionLabel
    labels = recommendations.filter(r => r.shortcut && r.label !== numSectionLabel).map(r => r.label)
  }

  const _onScrollToSection = (label: string) => {
    if (sectionListRef.current) {
      const ref = sectionListRef.current
      const sectionIndex =
        (recommendations &&
          (label === 'numSection'
            ? recommendations.length - 1
            : recommendations.findIndex(section => section.label === label))) ||
        -1
      if (sectionIndex >= 0 && Styles.isMobile) {
        ref.scrollToLocation({
          animated: false,
          itemIndex: 0,
          sectionIndex,
        })
      }
    }
  }

  if (!labels.length) {
    return null
  }
  return (
    <>
      <AlphabetIndex
        labels={labels}
        showNumSection={showNumSection}
        onScroll={_onScrollToSection}
        style={styles.alphabetIndex}
        measureKey={!!teamSoFar.length}
      />
    </>
  )
}

const modalHeaderProps = (
  props: Pick<
    Props,
    'onClose' | 'namespace' | 'teamSoFar' | 'teamID' | 'onFinishTeamBuilding' | 'title' | 'goButtonLabel'
  >
) => {
  const {onClose, namespace, teamSoFar, teamID, onFinishTeamBuilding, title, goButtonLabel} = props
  const mobileCancel = Styles.isMobile ? (
    <Kb.Text type="BodyBigLink" onClick={onClose}>
      Cancel
    </Kb.Text>
  ) : undefined
  switch (namespace) {
    case 'people': {
      return Styles.isMobile
        ? {
            hideBorder: true,
            leftButton: mobileCancel,
          }
        : undefined
    }
    case 'teams': {
      return {
        hideBorder: true,
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onClose} />,
        rightButton: Styles.isMobile ? (
          <Kb.Text
            type="BodyBigLink"
            onClick={teamSoFar.length ? onFinishTeamBuilding : undefined}
            style={!teamSoFar.length && styles.hide}
          >
            Done
          </Kb.Text>
        ) : undefined,
        title: <TeamsModalTitle teamID={teamID ?? noTeamID} title="Search people" />,
      }
    }
    case 'chat2': {
      const rightButton = Styles.isMobile ? (
        <Kb.Button
          label="Start"
          onClick={teamSoFar.length ? onFinishTeamBuilding : undefined}
          small={true}
          type="Success"
          style={!teamSoFar.length && styles.hide} // Need to hide this so modal can measure correctly
        />
      ) : undefined
      return {hideBorder: true, leftButton: mobileCancel, rightButton, title: title}
    }
    case 'crypto': {
      const rightButton = Styles.isMobile ? (
        <Kb.Button
          label={goButtonLabel ?? 'Start'}
          onClick={teamSoFar.length ? onFinishTeamBuilding : undefined}
          small={true}
          type="Success"
          style={!teamSoFar.length && styles.hide} // Need to hide this so modal can measure correctly
        />
      ) : undefined
      return {hideBorder: true, leftButton: mobileCancel, rightButton, title: title}
    }
    default: {
      return {hideBorder: true, leftButton: mobileCancel, title: title}
    }
  }
}

const SearchInput = (
  props: Pick<
    Props,
    | 'onChangeText'
    | 'selectedService'
    | 'namespace'
    | 'onDownArrowKeyDown'
    | 'onUpArrowKeyDown'
    | 'onEnterKeyDown'
    | 'searchString'
    | 'focusInputCounter'
    | 'onClear'
    | 'onClose'
  >
) => {
  const {
    selectedService,
    onChangeText,
    namespace,
    onDownArrowKeyDown,
    onUpArrowKeyDown,
    onEnterKeyDown,
    searchString,
    focusInputCounter,
    onClear,
    onClose,
  } = props
  const searchPlaceholder = 'Search ' + serviceIdToSearchPlaceholder(selectedService)
  return (
    <Input
      onChangeText={onChangeText}
      onClear={namespace === 'people' && !searchString ? onClose : onClear}
      onDownArrowKeyDown={onDownArrowKeyDown}
      onUpArrowKeyDown={onUpArrowKeyDown}
      onEnterKeyDown={onEnterKeyDown}
      placeholder={searchPlaceholder}
      searchString={searchString}
      focusOnMount={!Styles.isMobile || selectedService !== 'keybase'}
      focusCounter={focusInputCounter}
    />
  )
}

const Suggestions = (props: Pick<Props, 'namespace' | 'selectedService'>) => {
  const {namespace, selectedService} = props
  return (
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
          fontSize={48}
          type={serviceIdToIconFont(selectedService)}
          style={Styles.collapseStyles([
            !!selectedService && {color: serviceIdToAccentColor(selectedService)},
          ])}
        />
      )}
      {namespace === 'people' ? (
        <Kb.Text center={true} style={styles.emptyServiceText} type="BodySmall">
          Search for anyone on {serviceIdToLabel(selectedService)} and start a chat. Your messages will unlock
          after they install Keybase and prove their {serviceIdToLabel(selectedService)} username.
        </Kb.Text>
      ) : namespace === 'teams' ? (
        <Kb.Text center={true} style={styles.emptyServiceText} type="BodySmall">
          Add anyone from {serviceIdToLabel(selectedService)}, then tell them to install Keybase. They will
          automatically join the team once they sign up and prove their {serviceIdToLabel(selectedService)}{' '}
          username.
        </Kb.Text>
      ) : (
        <Kb.Text center={true} style={styles.emptyServiceText} type="BodySmall">
          Start a chat with anyone on {serviceIdToLabel(selectedService)}, then tell them to install Keybase.
          Your messages will unlock after they sign up and prove their {serviceIdToLabel(selectedService)}{' '}
          username.
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

const RecsAndRecos = (
  props: Pick<
    Props,
    | 'highlightedIndex'
    | 'recommendations'
    | 'recommendedHideYourself'
    | 'namespace'
    | 'selectedService'
    | 'onAdd'
    | 'onRemove'
    | 'teamSoFar'
  > &
    SectionListProp &
    OnScrollProps
) => {
  const {
    highlightedIndex,
    recommendations,
    sectionListRef,
    onScroll,
    recommendedHideYourself,
    namespace,
    selectedService,
    onAdd,
    onRemove,
    teamSoFar,
  } = props

  const ResultRow = namespace === 'people' ? PeopleResult : UserResult

  const _listIndexToSectionAndLocalIndex = memoize(
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

  const _getRecLayout = (
    sections: Array<SearchRecSection>,
    indexInList: number
  ): {index: number; length: number; offset: number} => {
    const sectionDividerHeight = Kb.SectionDivider.height
    const dataRowHeight = userResultHeight

    let numSections = 0
    let numData = 0
    let length = dataRowHeight
    let currSectionHeaderIdx = 0
    for (const s of sections) {
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

  const highlightDetails = _listIndexToSectionAndLocalIndex(highlightedIndex, recommendations)
  return (
    <Kb.BoxGrow>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.listContainer}>
        <SectionList
          ref={sectionListRef}
          contentContainerStyle={{minHeight: '133%'}}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          scrollEventThrottle={1}
          onScroll={onScroll}
          selectedIndex={Styles.isMobile ? undefined : highlightedIndex || 0}
          sections={recommendations ?? []}
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
          getItemLayout={_getRecLayout}
          renderItem={({index, item: result, section}) =>
            result.isImportButton ? (
              <ContactsImportButton />
            ) : result.isSearchHint ? (
              <SearchHintText />
            ) : recommendedHideYourself && result.isYou ? null : (
              <ResultRow
                namespace={namespace}
                resultForService={selectedService}
                username={result.username}
                prettyName={result.prettyName}
                pictureUrl={result.pictureUrl}
                displayLabel={result.displayLabel}
                services={result.services}
                inTeam={result.inTeam}
                isPreExistingTeamMember={result.isPreExistingTeamMember}
                isYou={result.isYou}
                followingState={result.followingState}
                highlight={
                  !Styles.isMobile &&
                  !!highlightDetails &&
                  namespace !== 'people' &&
                  highlightDetails.section === section &&
                  highlightDetails.index === index
                }
                userId={result.userId}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            )
          }
          renderSectionHeader={({section: {label}}: any) =>
            label && (!Styles.isMobile || label !== 'Recommendations') ? (
              <Kb.SectionDivider label={label} />
            ) : null
          }
        />
        {Styles.isMobile && (
          <TeamAlphabetIndex
            recommendations={recommendations}
            sectionListRef={sectionListRef}
            teamSoFar={teamSoFar}
          />
        )}
      </Kb.Box2>
    </Kb.BoxGrow>
  )
}

const ListBody = (
  props: Pick<
    Props,
    | 'namespace'
    | 'searchString'
    | 'recommendations'
    | 'selectedService'
    | 'showRecs'
    | 'showResults'
    | 'searchResults'
    | 'highlightedIndex'
    | 'recommendedHideYourself'
    | 'onAdd'
    | 'onRemove'
    | 'teamSoFar'
    | 'onSearchForMore'
  > &
    SectionListProp &
    OnScrollProps
) => {
  const {
    namespace,
    searchString,
    recommendations,
    selectedService,
    showRecs,
    showResults,
    searchResults,
    highlightedIndex,
    sectionListRef,
    onScroll,
    recommendedHideYourself,
    onAdd,
    onRemove,
    teamSoFar,
    onSearchForMore,
  } = props

  const ResultRow = namespace === 'people' ? PeopleResult : UserResult
  const showRecPending = !searchString && !recommendations && selectedService === 'keybase'
  const showLoading = !!searchString && !searchResults

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
  if (!showRecs && !showResults && !!selectedService) {
    return <Suggestions namespace={namespace} selectedService={selectedService} />
  }

  if (showRecs && recommendations) {
    return (
      <RecsAndRecos
        highlightedIndex={highlightedIndex}
        recommendations={recommendations}
        sectionListRef={sectionListRef}
        onScroll={onScroll}
        recommendedHideYourself={recommendedHideYourself}
        namespace={namespace}
        selectedService={selectedService}
        onAdd={onAdd}
        onRemove={onRemove}
        teamSoFar={teamSoFar}
      />
    )
  }

  const _onEndReached = throttle(() => {
    onSearchForMore()
  }, 500)

  return (
    <>
      {searchResults === undefined || searchResults?.length ? (
        <Kb.List
          reAnimated={true}
          items={searchResults || []}
          onScroll={onScroll}
          selectedIndex={highlightedIndex || 0}
          style={styles.list}
          contentContainerStyle={styles.listContentContainer}
          keyboardShouldPersistTaps="handled"
          keyProperty="key"
          onEndReached={_onEndReached}
          onEndReachedThreshold={0.1}
          renderItem={(index, result) => (
            <ResultRow
              key={result.username}
              resultForService={selectedService}
              username={result.username}
              prettyName={result.prettyName}
              pictureUrl={result.pictureUrl}
              displayLabel={result.displayLabel}
              services={result.services}
              namespace={namespace}
              inTeam={result.inTeam}
              isPreExistingTeamMember={result.isPreExistingTeamMember}
              isYou={result.isYou}
              followingState={result.followingState}
              highlight={!Styles.isMobile && index === highlightedIndex}
              userId={result.userId}
              onAdd={onAdd}
              onRemove={onRemove}
            />
          )}
        />
      ) : (
        <Kb.Text type="BodySmall" style={styles.noResults}>
          Sorry, no results were found.
        </Kb.Text>
      )}
    </>
  )
}

// TODO: the type of this is any
// If we fix this type, we'll need to add a bunch more mobile-only props to Kb.SectionList since this code uses
// a bunch of the native props.
const SectionList: typeof Kb.SectionList = Styles.isMobile
  ? Kb.ReAnimated.createAnimatedComponent(Kb.SectionList)
  : Kb.SectionList

const TeamBuilding = (props: Props) => {
  const {
    filterServices,
    includeContacts,
    waitingForCreate,
    focusInputCounter,
    goButtonLabel,
    highlightedIndex,
    namespace,
    onAdd,
    onChangeService,
    onChangeText,
    onClear,
    onClose,
    onDownArrowKeyDown,
    onEnterKeyDown,
    onFinishTeamBuilding,
    onRemove,
    onSearchForMore,
    onUpArrowKeyDown,
    recommendations,
    recommendedHideYourself,
    search,
    searchResults,
    searchString,
    selectedService,
    serviceResultCount,
    showRecs,
    showResults,
    rolePickerProps,
    error,
    showServiceResultCount,
    teamBuildingSearchResults,
    teamID,
    teamSoFar,
    title,
  } = props

  const dispatch = Container.useDispatch()

  const fetchUserRecs = React.useCallback(() => {
    dispatch(TeamBuildingGen.createFetchUserRecs({includeContacts: namespace === 'chat2', namespace}))
  }, [dispatch, namespace])

  const offset = React.useRef(Styles.isMobile ? new Kb.ReAnimated.Value(0) : undefined)
  const sectionListRef = React.useRef<Kb.SectionList<Section<ResultData, SearchRecSection>>>(null)

  React.useEffect(() => {
    fetchUserRecs()
    // once
    // eslint-disable-next-line
  }, [])

  const onScroll: OnScrollProps['onScroll'] = Styles.isMobile
    ? Kb.ReAnimated.event([{nativeEvent: {contentOffset: {y: offset.current}}}], {useNativeDriver: true})
    : undefined

  let content: React.ReactNode
  switch (selectedService) {
    case 'email':
      content = (
        <EmailSearch
          continueLabel={teamSoFar.length > 0 ? 'Add' : 'Continue'}
          namespace={namespace}
          teamBuildingSearchResults={teamBuildingSearchResults}
          search={search}
        />
      )
      break
    case 'phone':
      content = (
        <PhoneSearch
          continueLabel={teamSoFar.length > 0 ? 'Add' : 'Continue'}
          namespace={namespace}
          search={search}
          teamBuildingSearchResults={teamBuildingSearchResults}
        />
      )
      break
    default:
      content = (
        <>
          <SearchInput
            selectedService={selectedService}
            onChangeText={onChangeText}
            namespace={namespace}
            onDownArrowKeyDown={onDownArrowKeyDown}
            onUpArrowKeyDown={onUpArrowKeyDown}
            onEnterKeyDown={onEnterKeyDown}
            searchString={searchString}
            focusInputCounter={focusInputCounter}
            onClear={onClear}
            onClose={onClose}
          />
          {namespace === 'people' && !Styles.isMobile && (
            <FilteredServiceTabBar
              filterServices={filterServices}
              selectedService={selectedService}
              onChangeService={onChangeService}
              serviceResultCount={serviceResultCount}
              showServiceResultCount={showServiceResultCount}
              servicesShown={5} // wider bar, show more services
              minimalBorder={true} // only show bottom border on icon when active
              offset={1}
            />
          )}
          <ListBody
            namespace={namespace}
            searchString={searchString}
            recommendations={recommendations}
            selectedService={selectedService}
            showRecs={showRecs}
            showResults={showResults}
            searchResults={searchResults}
            highlightedIndex={highlightedIndex}
            sectionListRef={sectionListRef}
            onScroll={onScroll}
            recommendedHideYourself={recommendedHideYourself}
            onAdd={onAdd}
            onRemove={onRemove}
            teamSoFar={teamSoFar}
            onSearchForMore={onSearchForMore}
          />
          {waitingForCreate && (
            <Kb.Box2 direction="vertical" style={styles.waiting} alignItems="center">
              <Kb.ProgressIndicator type="Small" white={true} style={styles.waitingProgress} />
            </Kb.Box2>
          )}
        </>
      )
  }
  const teamBox = !!teamSoFar.length && (
    <TeamBox
      allowPhoneEmail={selectedService === 'keybase' && includeContacts}
      onChangeText={onChangeText}
      onDownArrowKeyDown={onDownArrowKeyDown}
      onUpArrowKeyDown={onUpArrowKeyDown}
      onEnterKeyDown={onEnterKeyDown}
      onFinishTeamBuilding={onFinishTeamBuilding}
      onRemove={onRemove}
      teamSoFar={teamSoFar}
      searchString={searchString}
      rolePickerProps={rolePickerProps}
      goButtonLabel={goButtonLabel}
      waitingKey={teamID ? TeamConstants.teamWaitingKey(teamID) : null}
    />
  )

  // If there are no filterServices or if the filterServices has a phone
  const showContactsBanner = Styles.isMobile && (!filterServices || filterServices.includes('phone'))

  return (
    <Kb.Modal2
      header={modalHeaderProps({
        goButtonLabel,
        namespace,
        onClose,
        onFinishTeamBuilding,
        teamID,
        teamSoFar,
        title,
      })}
    >
      <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne} fullWidth={true}>
        {teamBox &&
          (Styles.isMobile ? (
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              {teamBox}
            </Kb.Box2>
          ) : (
            teamBox
          ))}
        {!!error && <Kb.Banner color="red">{error}</Kb.Banner>}
        {(namespace !== 'people' || Styles.isMobile) && (
          <FilteredServiceTabBar
            filterServices={filterServices}
            selectedService={selectedService}
            onChangeService={onChangeService}
            serviceResultCount={serviceResultCount}
            showServiceResultCount={showServiceResultCount}
            offset={offset.current}
          />
        )}
        {showContactsBanner && (
          <ContactsBanner
            namespace={namespace}
            onRedoSearch={() => onChangeText(searchString)}
            selectedService={selectedService}
          />
        )}
        {content}
      </Kb.Box2>
    </Kb.Modal2>
  )
}

TeamBuilding.navigationOptions = ({route}) => {
  const namespace: unknown = route.params.namespace
  const common = {
    modal2: true,
    modal2AvoidTabs: false,
    modal2ClearCover: false,
    modal2Style: {alignSelf: 'center'},
    modal2Type: 'DefaultFullHeight',
  }

  return namespace === 'people'
    ? {
        ...common,
        modal2AvoidTabs: true,
        modal2ClearCover: true,
        modal2Style: {
          alignSelf: 'flex-start',
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
          paddingTop: Styles.globalMargins.mediumLarge,
        },
        modal2Type: 'DefaultFullWidth',
      }
    : common
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
      container: Styles.platformStyles({
        common: {position: 'relative'},
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
          paddingBottom: Styles.globalMargins.small,
          paddingTop: Styles.globalMargins.small,
        },
      }),
      headerContainer: Styles.platformStyles({
        isElectron: {
          marginBottom: Styles.globalMargins.xtiny,
          marginTop: Styles.globalMargins.small + 2,
        },
      }),
      hide: {opacity: 0},
      list: Styles.platformStyles({
        common: {paddingBottom: Styles.globalMargins.small},
      }),
      listContainer: Styles.platformStyles({
        common: {position: 'relative'},
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
        isElectron: {margin: Styles.globalMargins.xsmall},
      }),
      noResults: {
        flex: 1,
        textAlign: 'center',
        ...Styles.padding(Styles.globalMargins.small),
      },
      peoplePopupStyleClose: Styles.platformStyles({isElectron: {display: 'none'}}),
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
