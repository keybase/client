import * as Constants from '../constants/team-building'
import * as WaitingConstants from '../constants/waiting'
import * as ChatConstants from '../constants/chat2'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as TeamConstants from '../constants/teams'
import EmailSearch from './email-search'
import Input from './input'
import PhoneSearch from './phone-search'
import TeamBox from './team-box'
import type * as Types from './types'
import type {ServiceIdWithContact} from '../constants/types/team-building'
import {ContactsBanner} from './contacts'
import {ListBody} from './list-body'
import {ModalTitle as TeamsModalTitle} from '../teams/common'
import {ServiceTabBar} from './service-tab-bar'
import {noTeamID} from '../constants/types/teams'
import {serviceIdToSearchPlaceholder} from './shared'

const FilteredServiceTabBar = (
  props: Omit<React.ComponentPropsWithoutRef<typeof ServiceTabBar>, 'services'> & {
    filterServices?: Array<ServiceIdWithContact>
  }
) => {
  const {selectedService, onChangeService, serviceResultCount, showServiceResultCount} = props
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
      showServiceResultCount={showServiceResultCount}
      servicesShown={servicesShown}
      minimalBorder={minimalBorder}
      offset={offset}
    />
  )
}

const modalHeaderProps = (
  props: Pick<
    Types.Props,
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

const TeamBuilding = (props: Types.Props) => {
  const {
    error,
    filterServices,
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
    search,
    searchResults,
    searchString,
    selectedService,
    serviceResultCount,
    showServiceResultCount,
    teamBuildingSearchResults,
    teamID,
    teamSoFar,
    title,
  } = props

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
              showServiceResultCount={showServiceResultCount}
              servicesShown={5} // wider bar, show more services
              minimalBorder={true} // only show bottom border on icon when active
              offset={1}
            />
          )}
          <ListBody
            namespace={namespace}
            searchString={searchString}
            recommendations={recommendations /* TODO */}
            selectedService={selectedService}
            searchResults={searchResults /* TODO*/}
            highlightedIndex={highlightedIndex /* TODO */}
            onAdd={onAdd}
            onRemove={onRemove}
            teamSoFar={teamSoFar}
            onSearchForMore={onSearchForMore /* TODO */}
            offset={offset}
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
