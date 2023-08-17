import * as C from '../constants'
import * as ChatConstants from '../constants/chat2'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'
import * as T from '../constants/types'
import EmailSearch from './email-search'
import Input from './input'
import PhoneSearch from './phone-search'
import TeamBox from './team-box'
import logger from '../logger'
import trim from 'lodash/trim'
import {ContactsBanner} from './contacts'
import {ListBody} from './list-body'
import {getTeamMeta} from '../constants/teams'
import {serviceIdToSearchPlaceholder} from './shared'
import {FilteredServiceTabBar} from './filtered-service-tab-bar'
import {modalHeaderProps} from './modal-header-props'
import {useSharedValue} from '../common-adapters/reanimated'

const deriveTeamSoFar = (teamSoFar: Set<T.TB.User>): Array<T.TB.SelectedUser> =>
  [...teamSoFar].map(userInfo => {
    let username = ''
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

type OwnProps = {
  namespace: T.TB.AllowedNamespace
  teamID?: string
  filterServices?: Array<T.TB.ServiceIdWithContact>
  goButtonLabel?: T.TB.GoButtonLabel
  title?: string
  recommendedHideYourself?: boolean
}

const TeamBuilding = (p: OwnProps) => {
  const namespace = p.namespace ?? 'chat2'
  const teamID = p.teamID
  const filterServices = p.filterServices
  const goButtonLabel = p.goButtonLabel ?? 'Start'

  const [focusInputCounter, setFocusInputCounter] = React.useState(0)
  const [enterInputCounter, setEnterInputCounter] = React.useState(0)
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const [searchString, setSearchString] = React.useState('')
  const [selectedService, setSelectedService] = React.useState<T.TB.ServiceIdWithContact>('keybase')

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

  const searchResults = C.useTBContext(s => s.searchResults)
  const error = C.useTBContext(s => s.error)
  const _teamSoFar = C.useTBContext(s => s.teamSoFar)
  const userRecs = C.useTBContext(s => s.userRecs)

  const userResults: Array<T.TB.User> | undefined = searchResults
    .get(trim(searchString))
    ?.get(selectedService)

  const teamSoFar = deriveTeamSoFar(_teamSoFar)

  const cancelTeamBuilding = C.useTBContext(s => s.dispatch.cancelTeamBuilding)
  const finishTeamBuilding = C.useTBContext(s => s.dispatch.finishTeamBuilding)
  const finishedTeamBuilding = C.useTBContext(s => s.dispatch.finishedTeamBuilding)
  const removeUsersFromTeamSoFar = C.useTBContext(s => s.dispatch.removeUsersFromTeamSoFar)
  const addUsersToTeamSoFar = C.useTBContext(s => s.dispatch.addUsersToTeamSoFar)
  const fetchUserRecs = C.useTBContext(s => s.dispatch.fetchUserRecs)

  const _search = C.useTBContext(s => s.dispatch.search)
  const search = Container.useThrottledCallback(
    (query: string, service: T.TB.ServiceIdWithContact, limit?: number) => {
      _search(query, service, namespace === 'chat2', limit)
    },
    500
  )

  const onClose = cancelTeamBuilding
  const onFinishTeamBuilding = namespace === 'teams' ? finishTeamBuilding : finishedTeamBuilding
  const onRemove = React.useCallback(
    (userId: string) => {
      removeUsersFromTeamSoFar([userId])
    },
    [removeUsersFromTeamSoFar]
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
        userResults?.filter(u => u.id === userId)?.[0] ?? userRecs?.filter(u => u.id === userId)?.[0]

      if (!user) {
        logger.error(`Couldn't find Types.User to add for ${userId}`)
        onChangeText('')
        return
      }
      onChangeText('')
      addUsersToTeamSoFar([user])
      setHighlightedIndex(-1)
      incFocusInputCounter()
    },
    [userRecs, addUsersToTeamSoFar, onChangeText, setHighlightedIndex, incFocusInputCounter, userResults]
  )

  const onChangeService = React.useCallback(
    (service: T.TB.ServiceIdWithContact) => {
      setSelectedService(service)
      incFocusInputCounter()
      if (!T.TB.isContactServiceId(service)) {
        search(searchString, service)
      }
    },
    [search, incFocusInputCounter, setSelectedService, searchString]
  )

  const title = C.useTeamsState(s =>
    namespace === 'teams' ? `Add to ${getTeamMeta(s, teamID ?? '').teamname}` : p.title ?? ''
  )

  const waitingForCreate = Container.useAnyWaiting(ChatConstants.waitingKeyCreating)

  const offset = useSharedValue(0)

  Container.useOnMountOnce(() => {
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
      waitingKey={teamID ? C.teamWaitingKey(teamID) : undefined}
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
    }) as const
)

export default TeamBuilding
