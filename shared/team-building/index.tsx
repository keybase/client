import * as ChatConstants from '../constants/chat2'
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
import type {RootRouteProps} from '../router-v2/route-params'
import {ContactsBanner} from './contacts'
import {ListBody} from './list-body'
import {getTeamMeta} from '../constants/teams'
import {memoize} from '../util/memoize'
import {requestIdleCallback} from '../util/idle-callback'
import {serviceIdToSearchPlaceholder} from './shared'
import {useRoute} from '@react-navigation/native'
import {FilteredServiceTabBar} from './filtered-service-tab-bar'
import {modalHeaderProps} from './modal-header-props'
import {useSharedValue} from '../common-adapters/reanimated'

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
        dispatch(TeamBuildingGen.createSearch({includeContacts, limit, namespace, query, service}))
      })
    },
    time
  )
const debouncedSearch = makeDebouncedSearch(500) // 500ms debounce on social searches
const debouncedSearchKeybase = makeDebouncedSearch(200) // 200 ms debounce on keybase searches

const TeamBuilding = () => {
  const {params} = useRoute<RootRouteProps<'peopleTeamBuilder'>>()
  const dispatch = Container.useDispatch()
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
  const userResults: Array<TeamBuildingTypes.User> | undefined = teamBuildingState.searchResults
    .get(trim(searchString))
    ?.get(selectedService)

  const error = teamBuildingState.error
  const teamSoFar = deriveTeamSoFar(teamBuildingState.teamSoFar)

  const onClose = React.useCallback(() => {
    dispatch(TeamBuildingGen.createCancelTeamBuilding({namespace}))
  }, [dispatch, namespace])

  const search = React.useCallback(
    (query: string, service: TeamBuildingTypes.ServiceIdWithContact, limit?: number) => {
      if (service === 'keybase') {
        debouncedSearchKeybase(dispatch, namespace, query, service, namespace === 'chat2', limit)
      } else {
        debouncedSearch(dispatch, namespace, query, service, namespace === 'chat2', limit)
      }
    },
    [dispatch, namespace]
  )

  const onFinishTeamBuilding = React.useCallback(() => {
    dispatch(
      namespace === 'teams'
        ? TeamBuildingGen.createFinishTeamBuilding({namespace, teamID})
        : TeamBuildingGen.createFinishedTeamBuilding({namespace})
    )
  }, [dispatch, namespace, teamID])

  const onRemove = React.useCallback(
    (userId: string) => {
      dispatch(TeamBuildingGen.createRemoveUsersFromTeamSoFar({namespace, users: [userId]}))
    },
    [dispatch, namespace]
  )

  const onChangeText = React.useCallback(
    (newText: string) => {
      setSearchString(newText)
      search(newText, selectedService)
      setHighlightedIndex(0)
    },
    [setSearchString, search, setHighlightedIndex, selectedService]
  )

  const onClear = React.useCallback(() => onChangeText(''), [onChangeText])
  const onSearchForMore = React.useCallback(
    (len: number) => {
      if (len >= 10) {
        search(searchString, selectedService, len + 20)
      }
    },
    [search, selectedService, searchString]
  )
  const onAdd = React.useCallback(
    (userId: string) => {
      const user =
        userResults?.filter(u => u.id === userId)?.[0] ??
        teamBuildingState.userRecs?.filter(u => u.id === userId)?.[0]

      if (!user) {
        logger.error(`Couldn't find Types.User to add for ${userId}`)
        onChangeText('')
        return
      }
      onChangeText('')
      dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({namespace, users: [user]}))
      setHighlightedIndex(-1)
      incFocusInputCounter()
    },
    [
      dispatch,
      onChangeText,
      namespace,
      setHighlightedIndex,
      incFocusInputCounter,
      userResults,
      teamBuildingState,
    ]
  )

  const onChangeService = React.useCallback(
    (service: TeamBuildingTypes.ServiceIdWithContact) => {
      setSelectedService(service)
      incFocusInputCounter()
      if (!TeamBuildingTypes.isContactServiceId(service)) {
        search(searchString, service)
      }
    },
    [search, incFocusInputCounter, setSelectedService, searchString]
  )

  const route = useRoute<RootRouteProps<'peopleTeamBuilder'>>()
  const title = Container.useSelector(state =>
    namespace === 'teams' ? `Add to ${getTeamMeta(state, teamID ?? '').teamname}` : route.params?.title ?? ''
  )

  const waitingForCreate = Container.useSelector(state =>
    WaitingConstants.anyWaiting(state, ChatConstants.waitingKeyCreating)
  )

  const fetchUserRecs = React.useCallback(() => {
    dispatch(TeamBuildingGen.createFetchUserRecs({includeContacts: namespace === 'chat2', namespace}))
  }, [dispatch, namespace])

  const offset = useSharedValue(0)

  const fetchedOnce = React.useRef(false)
  React.useEffect(() => {
    if (!fetchedOnce.current) {
      fetchedOnce.current = true
      fetchUserRecs()
    }
  }, [fetchUserRecs, fetchedOnce])

  let content: React.ReactNode
  switch (selectedService) {
    case 'email':
      content = (
        <EmailSearch
          continueLabel={teamSoFar.length > 0 ? 'Add' : 'Continue'}
          namespace={namespace}
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
              servicesShown={5} // wider bar, show more services
              minimalBorder={true} // only show bottom border on icon when active
              offset={offset}
            />
          )}
          <ListBody
            enterInputCounter={enterInputCounter}
            namespace={namespace}
            searchString={searchString}
            selectedService={selectedService}
            highlightedIndex={highlightedIndex}
            onAdd={onAdd}
            onRemove={onRemove}
            teamSoFar={teamSoFar}
            onChangeText={onChangeText}
            onSearchForMore={onSearchForMore}
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
        hasTeamSoFar: teamSoFar.length > 0,
        namespace,
        onClose,
        onFinishTeamBuilding,
        teamID,
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
            offset={offset}
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
