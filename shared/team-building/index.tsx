import * as C from '@/constants'
import * as TB from '@/stores/team-building'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import EmailSearch from './email-search'
import Input from './input'
import PhoneSearch from './phone-search'
import TeamBox from './team-box'
import logger from '@/logger'
import {ContactsBanner} from './contacts'
import {ListBody} from './list-body'
import {serviceIdToSearchPlaceholder} from './shared'
import {FilteredServiceTabBar} from './filtered-service-tab-bar'
import {useSharedValue} from '@/common-adapters/reanimated'

const deriveSelectedUsers = (teamSoFar: ReadonlySet<T.TB.User>): Array<T.TB.SelectedUser> =>
  [...teamSoFar].map(userInfo => {
    let username: string
    let serviceId: T.TB.ServiceIdWithContact
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

const getUserResults = (
  searchResults: TB.State['searchResults'],
  searchString: string,
  selectedService: T.TB.ServiceIdWithContact
) => searchResults.get(searchString.trim())?.get(selectedService)

const findUserById = (users: ReadonlyArray<T.TB.User> | undefined, userId: string) =>
  users?.find(user => user.id === userId)

const shouldShowContactsBanner = (filterServices: ReadonlyArray<T.TB.ServiceIdWithContact> | undefined) =>
  Kb.Styles.isMobile && (!filterServices || filterServices.includes('phone'))

const noop = () => {}

const useTeamBuildingData = (searchString: string, selectedService: T.TB.ServiceIdWithContact) => {
  const {searchResults, error, rawTeamSoFar, userRecs} = TB.useTBContext(
    C.useShallow(s => ({
      error: s.error,
      rawTeamSoFar: s.teamSoFar,
      searchResults: s.searchResults,
      userRecs: s.userRecs,
    }))
  )

  return {
    error,
    teamSoFar: deriveSelectedUsers(rawTeamSoFar),
    userRecs,
    userResults: getUserResults(searchResults, searchString, selectedService),
  }
}

const useTeamBuildingActions = ({
  onFinishTeamBuilding,
  namespace,
  searchString,
  selectedService,
  userResults,
  userRecs,
  setFocusInputCounter,
  setHighlightedIndex,
  setSearchString,
  setSelectedService,
}: {
  onFinishTeamBuilding?: (() => void) | undefined
  namespace: T.TB.AllowedNamespace
  searchString: string
  selectedService: T.TB.ServiceIdWithContact
  userResults: ReadonlyArray<T.TB.User> | undefined
  userRecs: ReadonlyArray<T.TB.User> | undefined
  setFocusInputCounter: React.Dispatch<React.SetStateAction<number>>
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>
  setSearchString: React.Dispatch<React.SetStateAction<string>>
  setSelectedService: React.Dispatch<React.SetStateAction<T.TB.ServiceIdWithContact>>
}) => {
  const {
    addUsersToTeamSoFar,
    cancelTeamBuilding,
    dispatchSearch,
    fetchUserRecs,
    removeUsersFromTeamSoFar,
  } = TB.useTBContext(
    C.useShallow(s => ({
      addUsersToTeamSoFar: s.dispatch.addUsersToTeamSoFar,
      cancelTeamBuilding: s.dispatch.cancelTeamBuilding,
      dispatchSearch: s.dispatch.search,
      fetchUserRecs: s.dispatch.fetchUserRecs,
      removeUsersFromTeamSoFar: s.dispatch.removeUsersFromTeamSoFar,
    }))
  )

  const search = C.useThrottledCallback(
    (query: string, service: T.TB.ServiceIdWithContact, limit?: number) => {
      dispatchSearch(query, service, namespace === 'chat', limit)
    },
    500
  )

  const focusInput = () => {
    setFocusInputCounter(old => old + 1)
  }

  const onChangeText = (newText: string) => {
    setSearchString(newText)
    search(newText, selectedService)
    setHighlightedIndex(0)
  }

  const onAdd = (userId: string) => {
    const user = findUserById(userResults, userId) ?? findUserById(userRecs, userId)
    if (!user) {
      logger.error(`Couldn't find Types.User to add for ${userId}`)
      onChangeText('')
      return
    }

    onChangeText('')
    addUsersToTeamSoFar([user])
    setHighlightedIndex(-1)
    focusInput()
  }

  const onChangeService = (service: T.TB.ServiceIdWithContact) => {
    setSelectedService(service)
    focusInput()
    if (!T.TB.isContactServiceId(service)) {
      search(searchString, service)
    }
  }

  return {
    cancelTeamBuilding,
    fetchUserRecs,
    onAdd,
    onChangeService,
    onChangeText,
    onFinishTeamBuilding: onFinishTeamBuilding ?? noop,
    onRemove: (userId: string) => {
      removeUsersFromTeamSoFar([userId])
    },
    onSearchForMore: (len: number) => {
      if (len >= 10) {
        search(searchString, selectedService, len + 20)
      }
    },
    search,
  }
}

type OwnProps = {
  namespace: T.TB.AllowedNamespace
  teamID?: string | undefined
  filterServices?: Array<T.TB.ServiceIdWithContact> | undefined
  goButtonLabel?: T.TB.GoButtonLabel | undefined
  onFinishTeamBuilding?: (() => void) | undefined
  title?: string | undefined
  recommendedHideYourself?: boolean | undefined
}

const TeamBuilding = ({
  namespace,
  teamID,
  filterServices,
  goButtonLabel = 'Start',
  onFinishTeamBuilding: onFinishTeamBuildingProp,
}: OwnProps) => {
  const [focusInputCounter, setFocusInputCounter] = React.useState(0)
  const [enterInputCounter, setEnterInputCounter] = React.useState(0)
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const [searchString, setSearchString] = React.useState('')
  const [selectedService, setSelectedService] = React.useState<T.TB.ServiceIdWithContact>('keybase')

  const onDownArrowKeyDown = () => {
    setHighlightedIndex(old => old + 1)
  }

  const onUpArrowKeyDown = () => {
    setHighlightedIndex(old => (old < 1 ? 0 : old - 1))
  }

  const onEnterKeyDown = () => {
    setEnterInputCounter(old => old + 1)
  }

  const {error, teamSoFar, userRecs, userResults} = useTeamBuildingData(searchString, selectedService)
  const {
    cancelTeamBuilding,
    fetchUserRecs,
    onAdd,
    onChangeService,
    onChangeText,
    onFinishTeamBuilding: finishTeamBuilding,
    onRemove,
    onSearchForMore,
    search,
  } = useTeamBuildingActions({
    namespace,
    onFinishTeamBuilding: onFinishTeamBuildingProp,
    searchString,
    selectedService,
    setFocusInputCounter,
    setHighlightedIndex,
    setSearchString,
    setSelectedService,
    userRecs,
    userResults,
  })

  const onClose = cancelTeamBuilding
  const onClear = () => onChangeText('')

  const waitingForCreate = C.Waiting.useAnyWaiting(C.waitingKeyChatCreating)

  const offset = useSharedValue(0)

  C.useOnMountOnce(() => {
    fetchUserRecs()
  })

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
            focusOnMount={!Kb.Styles.isMobile || selectedService !== 'keybase'}
            focusCounter={focusInputCounter}
          />
          {namespace === 'people' && !Kb.Styles.isMobile && (
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
            onFinishTeamBuilding={finishTeamBuilding}
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
      allowPhoneEmail={selectedService === 'keybase' && namespace === 'chat'}
      onChangeText={onChangeText}
      onDownArrowKeyDown={onDownArrowKeyDown}
      onUpArrowKeyDown={onUpArrowKeyDown}
      onEnterKeyDown={onEnterKeyDown}
      onFinishTeamBuilding={finishTeamBuilding}
      onRemove={onRemove}
      teamSoFar={teamSoFar}
      searchString={searchString}
      goButtonLabel={goButtonLabel}
      waitingKey={teamID ? C.waitingKeyTeamsTeam(teamID) : undefined}
    />
  )

  const errorBanner = !!error && <Kb.Banner color="red">{error}</Kb.Banner>
  const showContactsBanner = shouldShowContactsBanner(filterServices)

  return (
    <>
      <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
        {teamBox}
        {errorBanner}
        {(namespace !== 'people' || Kb.Styles.isMobile) && (
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
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    common: {...Kb.Styles.globalStyles.flexOne},
    isElectron: {minHeight: 500},
  }),
  waiting: {
    ...Kb.Styles.globalStyles.fillAbsolute,
    backgroundColor: Kb.Styles.globalColors.black_20,
  },
  waitingProgress: {
    height: 48,
    width: 48,
  },
}))

export default TeamBuilding
