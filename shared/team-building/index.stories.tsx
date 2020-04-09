import * as React from 'react'
import * as Sb from '../stories/storybook'
import * as Types from '../constants/types/team-building'
import emailSearch from './email-search/index.stories'
import UserBubble from './user-bubble'
import TeamBuilding from './index'
import Input from './input'
import TeamBox from './team-box'
import GoButton from './go-button'
import {ServiceTabBar} from './service-tab-bar'
import UserResult from './search-result/user-result'
import PeopleResult from './search-result/people-result'
import PhoneSearch from './phone-search'
import {ContactRestricted} from './contact-restricted'
import * as Constants from '../constants/team-building'

const provider = Sb.createPropProviderWithCommon(
  Sb.PropProviders.Avatar(['following', 'both'], ['followers', 'both'])
)

const generateTeamSofar = (count: number) => {
  const adjs = ['shaky', 'ded', 'smol', 'big', 'breaker of chains,', 'the kind', 'the erudite']
  const nouns = ['dino', 'frog', 'potato', 'dog', 'chris']
  const services: Array<Types.ServiceIdWithContact> = ['keybase', 'twitter', 'reddit']
  return new Array(count).fill('').map((_, i) => {
    const adj = adjs[i % adjs.length]
    const noun = nouns[Math.floor(i / adjs.length) % nouns.length]
    const service = services[i % services.length]
    const username = `${noun}${i}`
    return {
      prettyName: `${adj} ${noun}`,
      service,
      userId: `${username}${service === 'keybase' ? '' : `@${service}`}`,
      username: `${username}`,
    }
  })
}

const defaultUserResult = {
  displayLabel: '',
  followingState: 'Following' as const,
  highlight: false,
  inTeam: false,
  isPreExistingTeamMember: false,
  namespace: 'people',
  prettyName: 'Max Krohn',
  resultForService: 'keybase',
  services: {
    facebook: 'maxtaco',
    github: 'maxtaco',
    hackernews: 'maxtaco',
    keybase: 'maxtaco',
    reddit: 'maxtaco',
    twitter: 'maxtaco',
  },
  username: 'max',
}

const makeUserResults = results =>
  results.map((result, index) => (
    <UserResult
      key={index}
      username={result.username}
      prettyName={result.prettyName}
      displayLabel={result.displayLabel}
      resultForService={result.resultForService}
      services={result.services}
      followingState={result.followingState}
      namespace="people"
      highlight={result.highlight}
      isYou={result.isYou}
      inTeam={result.inTeam}
      isPreExistingTeamMember={result.isPreExistingTeamMember}
      onAdd={Sb.action('onAdd')}
      onRemove={Sb.action('onRemove')}
    />
  ))

const makePeopleResults = results =>
  results.map((result, index) => (
    <PeopleResult
      key={index}
      username={result.username}
      prettyName={result.prettyName}
      displayLabel={result.displayLabel}
      resultForService={result.resultForService}
      namespace="people"
      services={result.services}
      followingState={result.followingState}
      highlight={result.highlight}
      inTeam={result.inTeam}
      isPreExistingTeamMember={result.isPreExistingTeamMember}
      isYou={result.isYou}
      onAdd={Sb.action('onAdd')}
      onRemove={Sb.action('onRemove')}
    />
  ))

const commonProps = {
  focusInputCounter: 0,
  onClose: Sb.action('onClose'),
  showRecs: false,
  showResults: false,
  showServiceResultCount: false,
  teamID: undefined,
  teamname: '',
}

const contactProps = {
  contactsImported: false,
  contactsPermissionStatus: 'granted',
  isImportPromptDismissed: false,
  numContactsImported: 0,
  onAskForContactsLater: Sb.action('onAskForContactsLater'),
  onImportContacts: Sb.action('onImportContacts'),
  onLoadContactsSetting: Sb.action('onLoadContactsSetting'),
}

const eventHandlers = {
  incFocusInputCounter: Sb.action('incFocusInputCounter'),
  onChangeService: Sb.action('onChangeService'),
  onChangeText: Sb.action('onChangeText'),
  onClear: Sb.action('onClear'),
  onDownArrowKeyDown: Sb.action('onDownArrowKeyDown'),
  onEnterKeyDown: Sb.action('onEnterKeyDown'),
  onFinishTeamBuilding: Sb.action('onFinishTeamBuilding'),
  onMakeItATeam: Sb.action('onMakeItATeam'),
  onRemove: Sb.action('onRemove'),
  onTabBarScroll: Sb.action('onTabBarScroll'),
  onTabBarSleepy: Sb.action('onTabBarSleepy'),
  onUpArrowKeyDown: Sb.action('onUpArrowKeyDown'),
}

const load = () => {
  Sb.storiesOf('Team-Building', module)
    .addDecorator(provider)
    .add('Team Building', () => (
      <TeamBuilding
        {...commonProps}
        {...contactProps}
        {...eventHandlers}
        namespace="chat2"
        title="The Title"
        fetchUserRecs={() => {}}
        includeContacts={true}
        recommendations={[]}
        searchString="chris"
        selectedService="keybase"
        waitingForCreate={false}
        onSearchForMore={() => {
          Sb.action('onSearchForMore')
        }}
        teamSoFar={[
          {
            prettyName: 'max (Max Krohn)',
            service: 'keybase',
            userId: 'max',
            username: 'max',
          },
          {
            prettyName: 'marcopolo (GitHub)',
            service: 'github',
            userId: 'marcopolo@github',
            username: 'marcopolo',
          },
          {
            prettyName: 'chris (Chris Coyne)',
            service: 'keybase',
            userId: 'chris',
            username: 'chris',
          },
        ]}
        serviceResultCount={{}}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
        search={Sb.action('search')}
        searchResults={[
          {
            contact: false,
            displayLabel: 'Chris Coyne',
            followingState: 'Following' as const,
            inTeam: true,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Coyne',
            services: {
              facebook: 'chriscoyne',
              github: 'malgorithms',
              hackernews: 'malgorithms',
              keybase: 'chris',
              reddit: 'malgorithms',
              twitter: 'malgorithms',
            },
            userId: 'chris',
            username: 'chris',
          },
          {
            contact: false,
            displayLabel: 'Chris Mikacle',
            followingState: 'NotFollowing' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Mikacle',
            services: {
              github: 'chrismikacle',
              hackernews: 'chrismikacle',
              keybase: 'chrismikacle',
              reddit: 'chrismikacle',
              twitter: 'chrismikacle',
            },
            userId: 'chrismikacle',
            username: 'chrismikacle',
          },
          {
            contact: false,
            displayLabel: 'Chris Nojima',
            followingState: 'Following' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Nojima',
            services: {
              github: 'cnojima',
              hackernews: 'cnojima',
              keybase: 'chrisnojima',
              reddit: 'cnojima',
              twitter: 'cnojima',
            },
            userId: 'chrisnojima',
            username: 'chrisnojima',
          },
        ]}
        teamBuildingSearchResults={new Map()}
      />
    ))
    .add('Team Building - No search string', () => (
      <TeamBuilding
        {...commonProps}
        {...contactProps}
        {...eventHandlers}
        namespace="chat2"
        includeContacts={true}
        title="The Title"
        fetchUserRecs={() => {}}
        recommendations={[]}
        searchString=""
        selectedService="keybase"
        waitingForCreate={false}
        onSearchForMore={() => {
          Sb.action('onSearchForMore')
        }}
        teamSoFar={[
          {
            prettyName: 'max (Max Krohn)',
            service: 'keybase',
            userId: 'max',
            username: 'max',
          },
          {
            prettyName: 'marcopolo (GitHub)',
            service: 'github',
            userId: 'marcopolo@github',
            username: 'marcopolo',
          },
          {
            prettyName: 'chris (Chris Coyne)',
            service: 'keybase',
            userId: 'chris',
            username: 'chris',
          },
        ]}
        serviceResultCount={{}}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
        search={Sb.action('search')}
        searchResults={[
          {
            contact: false,
            displayLabel: 'Chris Coyne',
            followingState: 'Following' as const,
            inTeam: true,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Coyne',
            services: {
              facebook: 'chriscoyne',
              github: 'malgorithms',
              hackernews: 'malgorithms',
              keybase: 'chris',
              reddit: 'malgorithms',
              twitter: 'malgorithms',
            },
            userId: 'chris',
            username: 'chris',
          },
          {
            contact: false,
            displayLabel: 'Chris Mikacle',
            followingState: 'NotFollowing' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Mikacle',
            services: {
              github: 'chrismikacle',
              hackernews: 'chrismikacle',
              keybase: 'chrismikacle',
              reddit: 'chrismikacle',
              twitter: 'chrismikacle',
            },
            userId: 'chrismikacle',
            username: 'chrismikacle',
          },
          {
            contact: false,
            displayLabel: 'Chris Nojima',
            followingState: 'Following' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Nojima',
            services: {
              github: 'cnojima',
              hackernews: 'cnojima',
              keybase: 'chrisnojima',
              reddit: 'cnojima',
              twitter: 'cnojima',
            },
            userId: 'chrisnojima',
            username: 'chrisnojima',
          },
        ]}
        teamBuildingSearchResults={new Map()}
      />
    ))
    .add('Team Building - Show role picker', () => (
      <TeamBuilding
        {...commonProps}
        {...contactProps}
        {...eventHandlers}
        namespace="chat2"
        title="Keybase Test Team"
        includeContacts={true}
        rolePickerProps={{
          changeSendNotification: Sb.action('changeSendNotification'),
          changeShowRolePicker: Sb.action('changeShowRolePicker'),
          disabledRoles: {},
          onSelectRole: Sb.action('confirmRolePicker'),
          selectedRole: 'writer',
          sendNotification: true,
          showRolePicker: true,
        }}
        searchString=""
        selectedService="keybase"
        waitingForCreate={false}
        recommendations={[]}
        fetchUserRecs={() => {}}
        onSearchForMore={() => {
          Sb.action('onSearchForMore')
        }}
        teamSoFar={[
          {
            prettyName: 'max (Max Krohn)',
            service: 'keybase',
            userId: 'max',
            username: 'max',
          },
        ]}
        serviceResultCount={{}}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
        search={Sb.action('search')}
        searchResults={[]}
        teamBuildingSearchResults={new Map()}
      />
    ))
    .add('Team Building - No search string or results', () => (
      <TeamBuilding
        {...commonProps}
        {...contactProps}
        {...eventHandlers}
        namespace="chat2"
        title="The Title"
        includeContacts={true}
        searchString=""
        selectedService="keybase"
        waitingForCreate={false}
        recommendations={[]}
        fetchUserRecs={() => {}}
        onSearchForMore={() => {
          Sb.action('onSearchForMore')
        }}
        teamSoFar={[]}
        search={Sb.action('search')}
        searchResults={[]}
        teamBuildingSearchResults={new Map()}
        serviceResultCount={{}}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
      />
    ))
    .add('Team Building - One line of users', () => (
      <TeamBuilding
        {...commonProps}
        {...contactProps}
        {...eventHandlers}
        namespace="chat2"
        title="The Title"
        includeContacts={true}
        searchString="chris"
        selectedService="keybase"
        waitingForCreate={false}
        recommendations={[]}
        fetchUserRecs={() => {}}
        onSearchForMore={() => {
          Sb.action('onSearchForMore')
        }}
        teamSoFar={generateTeamSofar(9)}
        serviceResultCount={{}}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
        search={Sb.action('search')}
        searchResults={[
          {
            contact: false,
            displayLabel: 'Chris Coyne',
            followingState: 'Following' as const,
            inTeam: true,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Coyne',
            services: {
              facebook: 'chriscoyne',
              github: 'malgorithms',
              hackernews: 'malgorithms',
              keybase: 'chris',
              reddit: 'malgorithms',
              twitter: 'malgorithms',
            },
            userId: 'chris',
            username: 'chris',
          },
          {
            contact: false,
            displayLabel: 'Chris Mikacle',
            followingState: 'NotFollowing' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Mikacle',
            services: {
              github: 'chrismikacle',
              hackernews: 'chrismikacle',
              keybase: 'chrismikacle',
              reddit: 'chrismikacle',
              twitter: 'chrismikacle',
            },
            userId: 'chrismikacle',
            username: 'chrismikacle',
          },
          {
            contact: false,
            displayLabel: 'Chris Nojima',
            followingState: 'Following' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Nojima',
            services: {
              github: 'cnojima',
              hackernews: 'cnojima',
              keybase: 'chrisnojima',
              reddit: 'cnojima',
              twitter: 'cnojima',
            },
            userId: 'chrisnojima',
            username: 'chrisnojima',
          },
        ]}
        teamBuildingSearchResults={new Map()}
      />
    ))
    .add('Team Building - One line of users + 1', () => (
      <TeamBuilding
        {...commonProps}
        {...contactProps}
        {...eventHandlers}
        namespace="chat2"
        title="The Title"
        includeContacts={true}
        searchString="chris"
        selectedService="keybase"
        waitingForCreate={false}
        recommendations={[]}
        fetchUserRecs={() => {}}
        onSearchForMore={() => {
          Sb.action('onSearchForMore')
        }}
        teamSoFar={generateTeamSofar(10)}
        serviceResultCount={{}}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
        search={Sb.action('search')}
        searchResults={[
          {
            contact: false,
            displayLabel: 'Chris Coyne',
            followingState: 'Following' as const,
            inTeam: true,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Coyne',
            services: {
              facebook: 'chriscoyne',
              github: 'malgorithms',
              hackernews: 'malgorithms',
              keybase: 'chris',
              reddit: 'malgorithms',
              twitter: 'malgorithms',
            },
            userId: 'chris',
            username: 'chris',
          },
          {
            contact: false,
            displayLabel: 'Chris Mikacle',
            followingState: 'NotFollowing' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Mikacle',
            services: {
              github: 'chrismikacle',
              hackernews: 'chrismikacle',
              keybase: 'chrismikacle',
              reddit: 'chrismikacle',
              twitter: 'chrismikacle',
            },
            userId: 'chrismikacle',
            username: 'chrismikacle',
          },
          {
            contact: false,
            displayLabel: 'Chris Nojima',
            followingState: 'Following' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Nojima',
            services: {
              github: 'cnojima',
              hackernews: 'cnojima',
              keybase: 'chrisnojima',
              reddit: 'cnojima',
              twitter: 'cnojima',
            },
            userId: 'chrisnojima',
            username: 'chrisnojima',
          },
        ]}
        teamBuildingSearchResults={new Map()}
      />
    ))
    .add('Team Building - Lotsa users', () => (
      <TeamBuilding
        {...commonProps}
        {...contactProps}
        {...eventHandlers}
        namespace="chat2"
        title="The Title"
        includeContacts={true}
        searchString="chris"
        selectedService="keybase"
        waitingForCreate={false}
        recommendations={[]}
        fetchUserRecs={() => {}}
        onSearchForMore={() => {
          Sb.action('onSearchForMore')
        }}
        teamSoFar={generateTeamSofar(100)}
        serviceResultCount={{}}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
        search={Sb.action('search')}
        searchResults={[
          {
            contact: false,
            displayLabel: 'Chris Coyne',
            followingState: 'Following' as const,
            inTeam: true,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Coyne',
            services: {
              facebook: 'chriscoyne',
              github: 'malgorithms',
              hackernews: 'malgorithms',
              keybase: 'chris',
              reddit: 'malgorithms',
              twitter: 'malgorithms',
            },
            userId: 'chris',
            username: 'chris',
          },
          {
            contact: false,
            displayLabel: 'Chris Mikacle',
            followingState: 'NotFollowing' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Mikacle',
            services: {
              github: 'chrismikacle',
              hackernews: 'chrismikacle',
              keybase: 'chrismikacle',
              reddit: 'chrismikacle',
              twitter: 'chrismikacle',
            },
            userId: 'chrismikacle',
            username: 'chrismikacle',
          },
          {
            contact: false,
            displayLabel: 'Chris Nojima',
            followingState: 'Following' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            isYou: false,
            prettyName: 'Chris Nojima',
            services: {
              github: 'cnojima',
              hackernews: 'cnojima',
              keybase: 'chrisnojima',
              reddit: 'cnojima',
              twitter: 'cnojima',
            },
            userId: 'chrisnojima',
            username: 'chrisnojima',
          },
        ]}
        teamBuildingSearchResults={new Map()}
      />
    ))

    .add('Input', () => (
      <Input
        placeholder="Type in some input inside"
        searchString=""
        onChangeText={Sb.action('onChangeText')}
        onClear={Sb.action('onClear')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        focusOnMount={true}
        focusCounter={0}
      />
    ))
    .add('TeamBox', () => (
      <TeamBox
        allowPhoneEmail={false}
        searchString=""
        onChangeText={Sb.action('onChangeText')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
        onFinishTeamBuilding={Sb.action('onFinishTeamBuilding')}
        onRemove={Sb.action('onRemove')}
        teamSoFar={[
          {
            prettyName: 'max (Max Krohn)',
            service: 'keybase',
            userId: 'max',
            username: 'max',
          },
          {
            prettyName: 'marcopolo (GitHub)',
            service: 'github',
            userId: 'marcopolo@github',
            username: 'marcopolo',
          },
        ]}
        waitingKey={null}
      />
    ))
    .add('Go Button', () => <GoButton label="Start" onClick={Sb.action('onClick')} waitingKey={null} />)

  Sb.storiesOf('Team-Building/User Bubble', module)
    .addDecorator(provider)
    .add('Plain', () => (
      <UserBubble
        username="max"
        tooltip="max (Max Krohn)"
        service="keybase"
        onRemove={Sb.action('onRemove')}
      />
    ))
    .add('GitHub', () => (
      <UserBubble
        username="marcopolo"
        tooltip="marcopolo (GitHub)"
        service="github"
        onRemove={Sb.action('onRemove')}
      />
    ))

  Sb.storiesOf('Team-Building/Service Tab Bar', module)
    .add('With Service Results counts', () => (
      <ServiceTabBar
        services={Constants.allServices}
        selectedService="keybase"
        onChangeService={Sb.action('onChangeService')}
        serviceResultCount={{
          hackernews: 10,
          keybase: 15,
          reddit: 10,
        }}
        showServiceResultCount={true}
      />
    ))
    .add('Pending results', () => (
      <ServiceTabBar
        services={Constants.allServices}
        selectedService="keybase"
        onChangeService={Sb.action('onChangeService')}
        serviceResultCount={{}}
        showServiceResultCount={true}
      />
    ))

  // Add active for every service
  const servicesToDisplay: Array<Types.ServiceIdWithContact> = [
    'keybase',
    'twitter',
    'facebook',
    'github',
    'reddit',
    'hackernews',
    'phone',
  ]
  servicesToDisplay.forEach(service => {
    Sb.storiesOf('Team-Building/Service Tab Bar', module).add(`${service} selected`, () => (
      <ServiceTabBar
        services={Constants.allServices}
        selectedService={service}
        onChangeService={Sb.action('onChangeService')}
        serviceResultCount={{}}
        showServiceResultCount={false}
      />
    ))
  })

  Sb.storiesOf('Team-Building/User Result', module)
    .addDecorator(provider)
    .add('Keybase/Contact Tab - Keybase User', () =>
      makeUserResults([
        {
          ...defaultUserResult,
        },
        {
          ...defaultUserResult,
          inTeam: true,
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
        },
        {
          ...defaultUserResult,
          inTeam: true,
          prettyName: '',
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          prettyName: '',
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: '',
        },
        {
          ...defaultUserResult,
          isPreExistingTeamMember: true,
        },
      ])
    )
    .add('Keybase/Contact Tab - Contacts', () =>
      makeUserResults([
        {
          ...defaultUserResult,
          displayLabel: '+1 (888) 555-5555 (work)',
          followingState: 'NotFollowing' as const,
          prettyName: 'Max Krohn',
          resultForService: 'keybase',
          services: {keybase: ''},
          username: '+18885125555',
        },
        {
          ...defaultUserResult,
          displayLabel: '+1 (888) 555-5555 (work)',
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: 'Max Krohn',
          resultForService: 'keybase',
          services: {keybase: ''},
          username: '+18885125555',
        },
        {
          ...defaultUserResult,
          displayLabel: 'maxwellkrohn@keybase',
          followingState: 'NotFollowing' as const,
          inTeam: false,
          prettyName: 'Max Krohn',
          resultForService: 'keybase',
          services: {keybase: ''},
          username: 'maxwellkrohn@keybase.io',
        },
        {
          ...defaultUserResult,
          displayLabel: 'maxwellkrohn@keybase',
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: 'Max Krohn',
          resultForService: 'keybase',
          services: {keybase: ''},
          username: 'maxwellkrohn@keybase.io',
        },
      ])
    )
    .add('Service Tab - Also Keybse User', () =>
      makeUserResults([
        {
          ...defaultUserResult,
          resultForService: 'twitter',
        },
        {
          ...defaultUserResult,
          inTeam: true,
          resultForService: 'twitter',
        },
        {
          ...defaultUserResult,
          inTeam: true,
          resultForService: 'reddit',
        },
        {
          ...defaultUserResult,
          inTeam: true,
          resultForService: 'facebook',
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          resultForService: 'reddit',
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          resultForService: 'facebook',
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          resultForService: 'github',
        },
      ])
    )
    .add('Service Tab - Not Keybase User - Full Name', () =>
      makeUserResults([
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          resultForService: 'twitter',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          resultForService: 'twitter',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          resultForService: 'twitter',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          resultForService: 'github',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          resultForService: 'github',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          resultForService: 'github',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          resultForService: 'facebook',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          resultForService: 'facebook',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          resultForService: 'facebook',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          resultForService: 'reddit',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          resultForService: 'reddit',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          resultForService: 'reddit',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
      ])
    )
    .add('Service Tab - Not Keybase User - No Name', () =>
      makeUserResults([
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          prettyName: '',
          resultForService: 'twitter',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: '',
          resultForService: 'twitter',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          prettyName: '',
          resultForService: 'twitter',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          prettyName: '',
          resultForService: 'github',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: '',
          resultForService: 'github',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          prettyName: '',
          resultForService: 'github',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          prettyName: '',
          resultForService: 'facebook',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: '',
          resultForService: 'facebook',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          prettyName: '',
          resultForService: 'facebook',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          prettyName: '',
          resultForService: 'reddit',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: '',
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          prettyName: '',
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          prettyName: '',
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: '',
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          prettyName: '',
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
      ])
    )

  Sb.storiesOf('Team-Building/People Result', module)
    .addDecorator(provider)
    .add('Keybase/Contact Tab - Keybase User', () =>
      makePeopleResults([
        {
          ...defaultUserResult,
        },
        {
          ...defaultUserResult,
          inTeam: true,
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
        },
        {
          ...defaultUserResult,
          inTeam: true,
          prettyName: '',
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          prettyName: '',
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: '',
        },
        {
          ...defaultUserResult,
          isPreExistingTeamMember: true,
        },
      ])
    )
    .add('Keybase/Contact Tab - Contacts', () =>
      makePeopleResults([
        {
          ...defaultUserResult,
          displayLabel: '+1 (888) 555-5555 (work)',
          followingState: 'NotFollowing' as const,
          prettyName: 'Max Krohn',
          resultForService: 'keybase',
          services: {keybase: ''},
          username: '+18885125555',
        },
        {
          ...defaultUserResult,
          displayLabel: '+1 (888) 555-5555 (work)',
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: 'Max Krohn',
          resultForService: 'keybase',
          services: {keybase: ''},
          username: '+18885125555',
        },
        {
          ...defaultUserResult,
          displayLabel: 'maxwellkrohn@keybase',
          followingState: 'NotFollowing' as const,
          inTeam: false,
          prettyName: 'Max Krohn',
          resultForService: 'keybase',
          services: {keybase: ''},
          username: 'maxwellkrohn@keybase.io',
        },
        {
          ...defaultUserResult,
          displayLabel: 'maxwellkrohn@keybase',
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: 'Max Krohn',
          resultForService: 'keybase',
          services: {keybase: ''},
          username: 'maxwellkrohn@keybase.io',
        },
      ])
    )
    .add('Service Tab - Also Keybse User', () =>
      makePeopleResults([
        {
          ...defaultUserResult,
          resultForService: 'twitter',
        },
        {
          ...defaultUserResult,
          inTeam: true,
          resultForService: 'twitter',
        },
        {
          ...defaultUserResult,
          inTeam: true,
          resultForService: 'reddit',
        },
        {
          ...defaultUserResult,
          inTeam: true,
          resultForService: 'facebook',
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          resultForService: 'reddit',
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          resultForService: 'facebook',
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          resultForService: 'github',
        },
      ])
    )
    .add('Service Tab - Not Keybase User - Full Name', () =>
      makePeopleResults([
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          resultForService: 'twitter',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          resultForService: 'twitter',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          resultForService: 'twitter',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          resultForService: 'github',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          resultForService: 'github',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          resultForService: 'github',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          resultForService: 'facebook',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          resultForService: 'facebook',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          resultForService: 'facebook',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          resultForService: 'reddit',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          resultForService: 'reddit',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          resultForService: 'reddit',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
      ])
    )
    .add('Service Tab - Not Keybase User - No Name', () =>
      makePeopleResults([
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          prettyName: '',
          resultForService: 'twitter',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: '',
          resultForService: 'twitter',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          prettyName: '',
          resultForService: 'twitter',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          prettyName: '',
          resultForService: 'github',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: '',
          resultForService: 'github',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          prettyName: '',
          resultForService: 'github',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          prettyName: '',
          resultForService: 'facebook',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: '',
          resultForService: 'facebook',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          prettyName: '',
          resultForService: 'facebook',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          prettyName: '',
          resultForService: 'reddit',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: '',
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          prettyName: '',
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          prettyName: '',
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: true,
          prettyName: '',
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
        {
          ...defaultUserResult,
          followingState: 'NotFollowing' as const,
          inTeam: false,
          isPreExistingTeamMember: true,
          prettyName: '',
          resultForService: 'hackernews',
          services: {...defaultUserResult.services, keybase: ''},
        },
      ])
    )

  Sb.storiesOf('Team-Building/Phone Search', module).add('Empty Phone Search', () => (
    <PhoneSearch
      continueLabel="Continue"
      namespace="chat2"
      search={Sb.action('search')}
      teamBuildingSearchResults={new Map()}
    />
  ))

  Sb.storiesOf('Team-Building/Contact restriction', module)
    .add('New private folder failed', () => <ContactRestricted source="newFolder" usernames={['cjb']} />)
    .add('Team add some failed', () => (
      <ContactRestricted source="teamAddSomeFailed" usernames={['cjb', 'max']} />
    ))
    .add('Team add all (multiple) failed', () => (
      <ContactRestricted source="teamAddAllFailed" usernames={['cjb', 'max']} />
    ))
    .add('Team add all (single) failed', () => (
      <ContactRestricted source="teamAddAllFailed" usernames={['cjb']} />
    ))
    .add('Wallets request failed', () => (
      <ContactRestricted source="walletsRequest" usernames={['cjb', 'max']} />
    ))

  emailSearch()
}

export default load
