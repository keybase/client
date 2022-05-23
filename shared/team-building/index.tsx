import * as ChatConstants from '../constants/chat2'
import * as Constants from '../constants/team-building'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as TeamConstants from '../constants/teams'
import * as TeamBuildingTypes from '../constants/types/team-building'
import * as WaitingConstants from '../constants/waiting'
import EmailSearch from './email-search'
import Input from './input'
import PhoneSearch from './phone-search'
import TeamBox from './team-box'
import debounce from 'lodash/debounce'
import logger from '../logger'
import trim from 'lodash/trim'
import type * as TeamTypes from '../constants/types/teams'
import type * as Types from './types'
import type {RootRouteProps} from '../router-v2/route-params'
import {ContactsBanner} from './contacts'
import {ListBody} from './list-body'
import {ModalTitle as TeamsModalTitle} from '../teams/common'
import {ServiceTabBar} from './service-tab-bar'
import {formatAnyPhoneNumbers} from '../util/phone-numbers'
import {getTeamMeta, getTeamDetails} from '../constants/teams'
import {memoize} from '../util/memoize'
import {noTeamID} from '../constants/types/teams'
import {requestIdleCallback} from '../util/idle-callback'
import {serviceIdToSearchPlaceholder} from './shared'
import {useRoute} from '@react-navigation/native'

const expensiveDeriveResults = (
  searchResults: Array<TeamBuildingTypes.User> | undefined,
  teamSoFar: Set<TeamBuildingTypes.User>,
  myUsername: string,
  followingState: Set<string>,
  preExistingTeamMembers: Map<string, TeamTypes.MemberInfo>
) =>
  searchResults &&
  searchResults.map(info => {
    const label = info.label || ''
    return {
      contact: !!info.contact,
      displayLabel: formatAnyPhoneNumbers(label),
      followingState: Constants.followStateHelperWithId(myUsername, followingState, info.serviceMap.keybase),
      inTeam: [...teamSoFar].some(u => u.id === info.id),
      isPreExistingTeamMember: preExistingTeamMembers.has(info.id),
      isYou: info.username === myUsername,
      key: [info.id, info.prettyName, info.label, String(!!info.contact)].join('&'),
      pictureUrl: info.pictureUrl,
      prettyName: formatAnyPhoneNumbers(info.prettyName),
      services: info.serviceMap,
      userId: info.id,
      username: info.username,
    }
  })

const deriveSearchResults = memoize(expensiveDeriveResults)

const deriveTeamSoFar = memoize(
  (teamSoFar: Set<TeamBuildingTypes.User>): Array<TeamBuildingTypes.SelectedUser> =>
    [...teamSoFar].map(userInfo => {
      let username = ''
      let serviceId: TeamBuildingTypes.ServiceIdWithContact
      if (userInfo.contact && userInfo.serviceMap.keybase) {
        // resolved contact - pass username @ 'keybase' to teambox
        // so keybase avatar is rendered.
        username = userInfo.serviceMap.keybase
        serviceId = 'keybase'
      } else if (userInfo.serviceId !== 'keybase' && userInfo.serviceMap.keybase) {
        // Not a keybase result but has Keybase username. Id will be compound assertion,
        // but we want to display Keybase username and profile pic in teambox.
        username = userInfo.serviceMap.keybase
        serviceId = 'keybase'
      } else {
        username = userInfo.username
        serviceId = userInfo.serviceId
      }
      return {
        pictureUrl: userInfo.pictureUrl,
        prettyName: userInfo.prettyName !== username ? userInfo.prettyName : '',
        service: serviceId,
        userId: userInfo.id,
        username,
      }
    })
)

const _deriveServiceResultCount = memoize((searchResults: TeamBuildingTypes.SearchResults, query: string) =>
  [
    ...(
      searchResults.get(trim(query)) ??
      new Map<TeamBuildingTypes.ServiceIdWithContact, Array<TeamBuildingTypes.User>>()
    ).entries(),
  ]
    .map(([key, results]) => [key, results.length] as const)
    .reduce<{[k: string]: number}>((o, [key, num]) => {
      o[key] = num
      return o
    }, {})
)
const emptyObject = {}
const deriveServiceResultCount = (searchResults: TeamBuildingTypes.SearchResults, query: string) => {
  const val = _deriveServiceResultCount(searchResults, query)
  if (Object.keys(val)) {
    return val
  }
  return emptyObject
}

const deriveUserFromUserIdFn = memoize(
  (
      searchResults: Array<TeamBuildingTypes.User> | undefined,
      recommendations: Array<TeamBuildingTypes.User> | undefined
    ) =>
    (userId: string): TeamBuildingTypes.User | null =>
      (searchResults || []).filter(u => u.id === userId)[0] ||
      (recommendations || []).filter(u => u.id === userId)[0] ||
      null
)

const emptyMap = new Map()

const makeDebouncedSearch = (time: number) =>
  debounce(
    (
      dispatch: Container.TypedDispatch,
      namespace: TeamBuildingTypes.AllowedNamespace,
      query: string,
      service: TeamBuildingTypes.ServiceIdWithContact,
      includeContacts: boolean,
      limit?: number
    ) => {
      requestIdleCallback(() => {
        dispatch(
          TeamBuildingGen.createSearch({
            includeContacts,
            limit,
            namespace,
            query,
            service,
          })
        )
      })
    },
    time
  )
const debouncedSearch = makeDebouncedSearch(500) // 500ms debounce on social searches
const debouncedSearchKeybase = makeDebouncedSearch(200) // 200 ms debounce on keybase searches

const FilteredServiceTabBar = (
  props: Omit<React.ComponentPropsWithoutRef<typeof ServiceTabBar>, 'services'> & {
    filterServices?: Array<TeamBuildingTypes.ServiceIdWithContact>
  }
) => {
  const {selectedService, onChangeService, serviceResultCount} = props
  const {servicesShown, minimalBorder, offset, filterServices} = props
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
      servicesShown={servicesShown}
      minimalBorder={minimalBorder}
      offset={offset}
    />
  )
}

const modalHeaderProps = (
  props: Pick<
    Types.Props,
    'onClose' | 'namespace' | 'teamSoFar' | 'teamID' | 'onFinishTeamBuilding' | 'goButtonLabel'
  > & {
    title: string
  }
) => {
  const {onClose, namespace, teamSoFar, teamID, onFinishTeamBuilding, title, goButtonLabel} = props
  const mobileCancel = Styles.isMobile ? (
    <Kb.Text type="BodyBigLink" onClick={onClose}>
      Cancel
    </Kb.Text>
  ) : undefined
  switch (namespace) {
    case 'people': {
      return Styles.isMobile ? {hideBorder: true, leftButton: mobileCancel} : undefined
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

const TeamBuilding = () => {
  const {params} = useRoute<RootRouteProps<'peopleTeamBuilder'>>()
  const namespace = params?.namespace ?? 'chat2'
  const teamID = params?.teamID
  const filterServices = params?.filterServices
  const goButtonLabel = params?.goButtonLabel ?? 'Start'

  const [focusInputCounter, setFocusInputCounter] = React.useState(0)
  const [enterInputCounter, setEnterInputCounter] = React.useState(0)
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const [searchString, setSearchString] = React.useState('')
  const [selectedService, setSelectedService] =
    React.useState<TeamBuildingTypes.ServiceIdWithContact>('keybase')

  const onDownArrowKeyDown = React.useCallback(() => {
    setHighlightedIndex(old => old + 1)
  }, [setHighlightedIndex])

  const onUpArrowKeyDown = React.useCallback(() => {
    setHighlightedIndex(old => (old < 1 ? 0 : old - 1))
  }, [setHighlightedIndex])

  const incFocusInputCounter = React.useCallback(() => {
    setFocusInputCounter(old => old + 1)
  }, [setFocusInputCounter])

  const onEnterKeyDown = React.useCallback(() => {
    setEnterInputCounter(old => old + 1)
  }, [setEnterInputCounter])

  const teamBuildingState = Container.useSelector(state => state[namespace].teamBuilding)
  const teamBuildingSearchResults = teamBuildingState.searchResults
  const userResults: Array<TeamBuildingTypes.User> | undefined = teamBuildingState.searchResults
    .get(trim(searchString))
    ?.get(selectedService)

  const maybeTeamDetails = Container.useSelector(state =>
    teamID ? getTeamDetails(state, teamID) : undefined
  )
  const preExistingTeamMembers: TeamTypes.TeamDetails['members'] = maybeTeamDetails?.members ?? emptyMap
  const username = Container.useSelector(state => state.config.username)
  const following = Container.useSelector(state => state.config.following)

  const error = teamBuildingState.error
  const searchResults = deriveSearchResults(
    userResults,
    teamBuildingState.teamSoFar,
    username,
    following,
    preExistingTeamMembers
  )
  const serviceResultCount = deriveServiceResultCount(teamBuildingState.searchResults, searchString)
  const teamSoFar = deriveTeamSoFar(teamBuildingState.teamSoFar)
  const userFromUserId = deriveUserFromUserIdFn(userResults, teamBuildingState.userRecs)

  const _onAdd = (user: TeamBuildingTypes.User) => {
    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({namespace, users: [user]}))
  }
  const onClose = () => {
    dispatch(TeamBuildingGen.createCancelTeamBuilding({namespace}))
  }

  const search = (query: string, service: TeamBuildingTypes.ServiceIdWithContact, limit?: number) => {
    if (service === 'keybase') {
      debouncedSearchKeybase(dispatch, namespace, query, service, namespace === 'chat2', limit)
    } else {
      debouncedSearch(dispatch, namespace, query, service, namespace === 'chat2', limit)
    }
  }

  const onFinishTeamBuilding = () => {
    dispatch(
      namespace === 'teams'
        ? TeamBuildingGen.createFinishTeamBuilding({namespace, teamID})
        : TeamBuildingGen.createFinishedTeamBuilding({namespace})
    )
  }
  const onRemove = (userId: string) => {
    dispatch(TeamBuildingGen.createRemoveUsersFromTeamSoFar({namespace, users: [userId]}))
  }

  const onChangeText = (newText: string) => {
    setSearchString(newText)
    search(newText, selectedService)
    setHighlightedIndex(0)
  }

  const onClear = () => onChangeText('')
  const onSearchForMore = () => {
    if (searchResults && searchResults.length >= 10) {
      search(searchString, selectedService, searchResults.length + 20)
    }
  }
  const onAdd = (userId: string) => {
    const user = userFromUserId(userId)
    if (!user) {
      logger.error(`Couldn't find Types.User to add for ${userId}`)
      onChangeText('')
      return
    }
    onChangeText('')
    _onAdd(user)
    setHighlightedIndex(-1)
    incFocusInputCounter()
  }

  const onChangeService = (service: TeamBuildingTypes.ServiceIdWithContact) => {
    setSelectedService(service)
    incFocusInputCounter()
    if (!TeamBuildingTypes.isContactServiceId(service)) {
      search(searchString, service)
    }
  }

  const route = useRoute<RootRouteProps<'peopleTeamBuilder'>>()

  const maybeTeamMeta = Container.useSelector(state => (teamID ? getTeamMeta(state, teamID) : undefined))
  const teamname = maybeTeamMeta?.teamname
  const title = namespace === 'teams' ? `Add to ${teamname}` : route.params?.title ?? ''

  const waitingForCreate = Container.useSelector(state =>
    WaitingConstants.anyWaiting(state, ChatConstants.waitingKeyCreating)
  )
  const dispatch = Container.useDispatch()

  const fetchUserRecs = React.useCallback(() => {
    dispatch(TeamBuildingGen.createFetchUserRecs({includeContacts: namespace === 'chat2', namespace}))
  }, [dispatch, namespace])

  const offset = React.useRef(Styles.isMobile ? new Kb.ReAnimated.Value(0) : undefined)

  React.useEffect(() => {
    fetchUserRecs()
    // once
    // eslint-disable-next-line
  }, [])

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
          <Input
            onChangeText={onChangeText}
            onClear={namespace === 'people' && !searchString ? onClose : onClear}
            onDownArrowKeyDown={onDownArrowKeyDown}
            onUpArrowKeyDown={onUpArrowKeyDown}
            onEnterKeyDown={onEnterKeyDown}
            placeholder={'Search ' + serviceIdToSearchPlaceholder(selectedService)}
            searchString={searchString}
            focusOnMount={!Styles.isMobile || selectedService !== 'keybase'}
            focusCounter={focusInputCounter}
          />
          {namespace === 'people' && !Styles.isMobile && (
            <FilteredServiceTabBar
              filterServices={filterServices}
              selectedService={selectedService}
              onChangeService={onChangeService}
              serviceResultCount={serviceResultCount}
              servicesShown={5} // wider bar, show more services
              minimalBorder={true} // only show bottom border on icon when active
              offset={1}
            />
          )}
          <ListBody
            enterInputCounter={enterInputCounter}
            namespace={namespace}
            searchString={searchString}
            selectedService={selectedService}
            searchResults={searchResults /* TODO*/}
            highlightedIndex={highlightedIndex /* TODO */}
            onAdd={onAdd}
            onRemove={onRemove}
            teamSoFar={teamSoFar}
            onChangeText={onChangeText}
            onSearchForMore={onSearchForMore /* TODO */}
            offset={offset}
            onFinishTeamBuilding={onFinishTeamBuilding}
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
      allowPhoneEmail={selectedService === 'keybase' && namespace === 'chat2'}
      onChangeText={onChangeText}
      onDownArrowKeyDown={onDownArrowKeyDown}
      onUpArrowKeyDown={onUpArrowKeyDown}
      onEnterKeyDown={onEnterKeyDown}
      onFinishTeamBuilding={onFinishTeamBuilding}
      onRemove={onRemove}
      teamSoFar={teamSoFar}
      searchString={searchString}
      goButtonLabel={goButtonLabel}
      waitingKey={teamID ? TeamConstants.teamWaitingKey(teamID) : null}
    />
  )

  const errorBanner = !!error && <Kb.Banner color="red">{error}</Kb.Banner>

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
        {teamBox}
        {errorBanner}
        {(namespace !== 'people' || Styles.isMobile) && (
          <FilteredServiceTabBar
            filterServices={filterServices}
            selectedService={selectedService}
            onChangeService={onChangeService}
            serviceResultCount={serviceResultCount}
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
      container: Styles.platformStyles({
        common: {position: 'relative'},
      }),
      headerContainer: Styles.platformStyles({
        isElectron: {
          marginBottom: Styles.globalMargins.xtiny,
          marginTop: Styles.globalMargins.small + 2,
        },
      }),
      hide: {opacity: 0},
      mobileFlex: Styles.platformStyles({
        isMobile: {flex: 1},
      }),
      newChatHeader: Styles.platformStyles({
        isElectron: {margin: Styles.globalMargins.xsmall},
      }),
      peoplePopupStyleClose: Styles.platformStyles({isElectron: {display: 'none'}}),
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
