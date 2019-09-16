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
import UserResult from './user-result'
import PhoneSearch from './phone-search'
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

const commonProps = {
  focusInputCounter: 0,
  showRecs: false,
  showResults: false,
  showServiceResultCount: false,
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
  onBackspace: Sb.action('onBackspace'),
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
            displayLabel: 'Chris Coyne',
            followingState: 'Following' as const,
            inTeam: true,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Coyne',
            services: {
              facebook: 'chriscoyne on Facebook',
              github: 'malgorithms on GitHub',
              hackernews: 'malgorithms on HackerNews',
              keybase: 'chris',
              reddit: 'malgorithms on Reddit',
              twitter: 'malgorithms on Twitter',
            },
            userId: 'chris',
            username: 'chris',
          },
          {
            displayLabel: 'Chris Mikacle',
            followingState: 'NotFollowing' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Mikacle',
            services: {
              github: 'chrismikacle on GitHub',
              hackernews: 'chrismikacle on HackerNews',
              keybase: 'chrismikacle',
              reddit: 'chrismikacle on Reddit',
              twitter: 'chrismikacle on Twitter',
            },
            userId: 'chrismikacle',
            username: 'chrismikacle',
          },
          {
            displayLabel: 'Chris Nojima',
            followingState: 'Following' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Nojima',
            services: {
              github: 'cnojima on GitHub',
              hackernews: 'cnojima on HackerNews',
              keybase: 'chrisnojima',
              reddit: 'cnojima on Reddit',
              twitter: 'cnojima on Twitter',
            },
            userId: 'chrisnojima',
            username: 'chrisnojima',
          },
        ]}
        teamBuildingSearchResults={{}}
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
            displayLabel: 'Chris Coyne',
            followingState: 'Following' as const,
            inTeam: true,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Coyne',
            services: {
              facebook: 'chriscoyne on Facebook',
              github: 'malgorithms on GitHub',
              hackernews: 'malgorithms on HackerNews',
              keybase: 'chris',
              reddit: 'malgorithms on Reddit',
              twitter: 'malgorithms on Twitter',
            },
            userId: 'chris',
            username: 'chris',
          },
          {
            displayLabel: 'Chris Mikacle',
            followingState: 'NotFollowing' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Mikacle',
            services: {
              github: 'chrismikacle on GitHub',
              hackernews: 'chrismikacle on HackerNews',
              keybase: 'chrismikacle',
              reddit: 'chrismikacle on Reddit',
              twitter: 'chrismikacle on Twitter',
            },
            userId: 'chrismikacle',
            username: 'chrismikacle',
          },
          {
            displayLabel: 'Chris Nojima',
            followingState: 'Following' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Nojima',
            services: {
              github: 'cnojima on GitHub',
              hackernews: 'cnojima on HackerNews',
              keybase: 'chrisnojima',
              reddit: 'cnojima on Reddit',
              twitter: 'cnojima on Twitter',
            },
            userId: 'chrisnojima',
            username: 'chrisnojima',
          },
        ]}
        teamBuildingSearchResults={{}}
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
        teamBuildingSearchResults={{}}
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
        teamBuildingSearchResults={{}}
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
            displayLabel: 'Chris Coyne',
            followingState: 'Following' as const,
            inTeam: true,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Coyne',
            services: {
              facebook: 'chriscoyne on Facebook',
              github: 'malgorithms on GitHub',
              hackernews: 'malgorithms on HackerNews',
              keybase: 'chris',
              reddit: 'malgorithms on Reddit',
              twitter: 'malgorithms on Twitter',
            },
            userId: 'chris',
            username: 'chris',
          },
          {
            displayLabel: 'Chris Mikacle',
            followingState: 'NotFollowing' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Mikacle',
            services: {
              github: 'chrismikacle on GitHub',
              hackernews: 'chrismikacle on HackerNews',
              keybase: 'chrismikacle',
              reddit: 'chrismikacle on Reddit',
              twitter: 'chrismikacle on Twitter',
            },
            userId: 'chrismikacle',
            username: 'chrismikacle',
          },
          {
            displayLabel: 'Chris Nojima',
            followingState: 'Following' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Nojima',
            services: {
              github: 'cnojima on GitHub',
              hackernews: 'cnojima on HackerNews',
              keybase: 'chrisnojima',
              reddit: 'cnojima on Reddit',
              twitter: 'cnojima on Twitter',
            },
            userId: 'chrisnojima',
            username: 'chrisnojima',
          },
        ]}
        teamBuildingSearchResults={{}}
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
            displayLabel: 'Chris Coyne',
            followingState: 'Following' as const,
            inTeam: true,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Coyne',
            services: {
              facebook: 'chriscoyne on Facebook',
              github: 'malgorithms on GitHub',
              hackernews: 'malgorithms on HackerNews',
              keybase: 'chris',
              reddit: 'malgorithms on Reddit',
              twitter: 'malgorithms on Twitter',
            },
            userId: 'chris',
            username: 'chris',
          },
          {
            displayLabel: 'Chris Mikacle',
            followingState: 'NotFollowing' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Mikacle',
            services: {
              github: 'chrismikacle on GitHub',
              hackernews: 'chrismikacle on HackerNews',
              keybase: 'chrismikacle',
              reddit: 'chrismikacle on Reddit',
              twitter: 'chrismikacle on Twitter',
            },
            userId: 'chrismikacle',
            username: 'chrismikacle',
          },
          {
            displayLabel: 'Chris Nojima',
            followingState: 'Following' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Nojima',
            services: {
              github: 'cnojima on GitHub',
              hackernews: 'cnojima on HackerNews',
              keybase: 'chrisnojima',
              reddit: 'cnojima on Reddit',
              twitter: 'cnojima on Twitter',
            },
            userId: 'chrisnojima',
            username: 'chrisnojima',
          },
        ]}
        teamBuildingSearchResults={{}}
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
            displayLabel: 'Chris Coyne',
            followingState: 'Following' as const,
            inTeam: true,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Coyne',
            services: {
              facebook: 'chriscoyne on Facebook',
              github: 'malgorithms on GitHub',
              hackernews: 'malgorithms on HackerNews',
              keybase: 'chris',
              reddit: 'malgorithms on Reddit',
              twitter: 'malgorithms on Twitter',
            },
            userId: 'chris',
            username: 'chris',
          },
          {
            displayLabel: 'Chris Mikacle',
            followingState: 'NotFollowing' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Mikacle',
            services: {
              github: 'chrismikacle on GitHub',
              hackernews: 'chrismikacle on HackerNews',
              keybase: 'chrismikacle',
              reddit: 'chrismikacle on Reddit',
              twitter: 'chrismikacle on Twitter',
            },
            userId: 'chrismikacle',
            username: 'chrismikacle',
          },
          {
            displayLabel: 'Chris Nojima',
            followingState: 'Following' as const,
            inTeam: false,
            isPreExistingTeamMember: false,
            prettyName: 'Chris Nojima',
            services: {
              github: 'cnojima on GitHub',
              hackernews: 'cnojima on HackerNews',
              keybase: 'chrisnojima',
              reddit: 'cnojima on Reddit',
              twitter: 'cnojima on Twitter',
            },
            userId: 'chrisnojima',
            username: 'chrisnojima',
          },
        ]}
        teamBuildingSearchResults={{}}
      />
    ))

    .add('Input', () => (
      <Input
        placeholder="Type in some input inside"
        searchString=""
        onBackspace={Sb.action('onBackspace')}
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
        onBackspace={Sb.action('onBackspace')}
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
      />
    ))
    .add('Go Button', () => <GoButton label="Start" onClick={Sb.action('onClick')} />)

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
    .add('Keybase/Contact Tab - Keybase User', () => (
      <>
        {/* Following */}
        <UserResult
          username="max"
          prettyName="Max Krohn"
          displayLabel=""
          resultForService="keybase"
          services={{
            facebook: 'max on Facebook',
            github: 'max on GitHub',
            hackernews: 'max on HackerNews',
            keybase: 'max',
            reddit: 'max on Reddit',
            twitter: 'max on Twitter',
          }}
          followingState={'Following' as const}
          highlight={false}
          inTeam={false}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
        {/* Following - inTream = true*/}
        <UserResult
          username="max"
          prettyName="Max Krohn"
          displayLabel=""
          resultForService="keybase"
          services={{
            facebook: 'max on Facebook',
            github: 'max on GitHub',
            hackernews: 'max on HackerNews',
            keybase: 'max',
            reddit: 'max on Reddit',
            twitter: 'max on Twitter',
          }}
          followingState={'Following' as const}
          highlight={false}
          inTeam={true}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
        {/* Not Following */}
        <UserResult
          username="max"
          prettyName="Max Krohn"
          displayLabel=""
          resultForService="keybase"
          services={{
            facebook: 'max on Facebook',
            github: 'max on GitHub',
            hackernews: 'max on HackerNews',
            keybase: 'max',
            reddit: 'max on Reddit',
            twitter: 'max on Twitter',
          }}
          followingState={'NotFollowing' as const}
          highlight={false}
          inTeam={false}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
        {/* NotFollowing - inTeam = true */}
        <UserResult
          username="max"
          prettyName="Max Krohn"
          displayLabel=""
          resultForService="keybase"
          services={{
            facebook: 'max on Facebook',
            github: 'max on GitHub',
            hackernews: 'max on HackerNews',
            keybase: 'max',
            reddit: 'max on Reddit',
            twitter: 'max on Twitter',
          }}
          followingState={'NotFollowing' as const}
          highlight={false}
          inTeam={true}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />

        {/* No Pretty Names - Following */}
        <UserResult
          username="max"
          prettyName=""
          displayLabel=""
          resultForService="keybase"
          services={{
            facebook: 'max on Facebook',
            github: 'max on GitHub',
            hackernews: 'max on HackerNews',
            keybase: 'max',
            reddit: 'max on Reddit',
            twitter: 'max on Twitter',
          }}
          followingState={'Following' as const}
          highlight={false}
          inTeam={false}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
        {/* No Pretty Names - Following - inTream = true*/}
        <UserResult
          username="max"
          prettyName=""
          displayLabel=""
          resultForService="keybase"
          services={{
            facebook: 'max on Facebook',
            github: 'max on GitHub',
            hackernews: 'max on HackerNews',
            keybase: 'max',
            reddit: 'max on Reddit',
            twitter: 'max on Twitter',
          }}
          followingState={'Following' as const}
          highlight={false}
          inTeam={true}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
        {/* No Pretty Names - Not Following */}
        <UserResult
          username="max"
          prettyName=""
          displayLabel=""
          resultForService="keybase"
          services={{
            facebook: 'max on Facebook',
            github: 'max on GitHub',
            hackernews: 'max on HackerNews',
            keybase: 'max',
            reddit: 'max on Reddit',
            twitter: 'max on Twitter',
          }}
          followingState={'NotFollowing' as const}
          highlight={false}
          inTeam={false}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
        {/* No Pretty Names - NotFollowing - inTeam = true */}
        <UserResult
          username="max"
          prettyName=""
          displayLabel=""
          resultForService="keybase"
          services={{
            facebook: 'max on Facebook',
            github: 'max on GitHub',
            hackernews: 'max on HackerNews',
            keybase: 'max',
            reddit: 'max on Reddit',
            twitter: 'max on Twitter',
          }}
          followingState={'NotFollowing' as const}
          highlight={false}
          inTeam={true}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />

        {/* Following - inPreExistingTeam = true */}
        <UserResult
          username="max"
          prettyName="Max Krohn"
          displayLabel=""
          resultForService="keybase"
          services={{
            facebook: 'max on Facebook',
            github: 'max on GitHub',
            hackernews: 'max on HackerNews',
            keybase: 'max',
            reddit: 'max on Reddit',
            twitter: 'max on Twitter',
          }}
          followingState={'Following' as const}
          highlight={false}
          inTeam={false}
          isPreExistingTeamMember={true}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
      </>
    ))
    .add('Keybase/Contact Tab - Contacts', () => (
      <UserResult
        username="+18885125555"
        prettyName="Max Krohn"
        displayLabel="+1 (888) 555-5555 (work)"
        resultForService="keybase"
        services={{
          keybase: '',
        }}
        followingState={'NotFollowing' as const}
        highlight={false}
        inTeam={false}
        isPreExistingTeamMember={false}
        onAdd={Sb.action('onAdd')}
        onRemove={Sb.action('onRemove')}
      />
    ))
    .add('Service Tab - Also Keybse User', () => (
      <>
        <UserResult
          username="max"
          prettyName="Max Krohn"
          displayLabel=""
          resultForService="twitter"
          services={{
            facebook: 'maxtaco',
            github: 'maxtaco',
            hackernews: 'maxtaco',
            keybase: 'max',
            reddit: 'maxtaco',
            twitter: 'maxtaco',
          }}
          followingState={'Following' as const}
          highlight={false}
          inTeam={false}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
        <UserResult
          username="max"
          prettyName="Max Krohn"
          displayLabel=""
          resultForService="twitter"
          services={{
            facebook: 'maxtaco',
            github: 'maxtaco',
            hackernews: 'maxtaco',
            keybase: 'max',
            reddit: 'maxtaco',
            twitter: 'maxtaco',
          }}
          followingState={'Following' as const}
          highlight={false}
          inTeam={true}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
        <UserResult
          username="max"
          prettyName="Max Krohn"
          displayLabel=""
          resultForService="reddit"
          services={{
            facebook: 'maxtaco',
            github: 'maxtaco',
            hackernews: 'maxtaco',
            keybase: 'max',
            reddit: 'maxtaco',
            twitter: 'maxtaco',
          }}
          followingState={'NotFollowing' as const}
          highlight={false}
          inTeam={false}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
        <UserResult
          username="max"
          prettyName="Max Krohn"
          displayLabel=""
          resultForService="facebook"
          services={{
            facebook: 'maxtaco',
            github: 'maxtaco',
            hackernews: 'maxtaco',
            keybase: 'max',
            reddit: 'maxtaco',
            twitter: 'maxtaco',
          }}
          followingState={'NotFollowing' as const}
          highlight={false}
          inTeam={true}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
        <UserResult
          username="max"
          prettyName="Max Krohn"
          displayLabel=""
          resultForService="github"
          services={{
            facebook: 'maxtaco',
            github: 'maxtaco',
            hackernews: 'maxtaco',
            keybase: 'max',
            reddit: 'maxtaco',
            twitter: 'maxtaco',
          }}
          followingState={'NotFollowing' as const}
          highlight={false}
          inTeam={false}
          isPreExistingTeamMember={true}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
      </>
    ))
    .add('Service Tab - Not Keybase User', () => (
      <>
        <UserResult
          username="max"
          prettyName=""
          displayLabel=""
          resultForService="twitter"
          services={{
            facebook: 'maxtaco',
            github: 'maxtaco',
            hackernews: 'maxtaco',
            reddit: 'maxtaco',
            twitter: 'maxtaco',
          }}
          followingState={'NotFollowing' as const}
          highlight={false}
          inTeam={false}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
        <UserResult
          username="max"
          prettyName=""
          displayLabel=""
          resultForService="twitter"
          services={{
            facebook: 'maxtaco',
            github: 'maxtaco',
            hackernews: 'maxtaco',
            reddit: 'maxtaco',
            twitter: 'maxtaco',
          }}
          followingState={'NotFollowing' as const}
          highlight={false}
          inTeam={true}
          isPreExistingTeamMember={false}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
        <UserResult
          username="max"
          prettyName=""
          displayLabel=""
          resultForService="twitter"
          services={{
            facebook: 'maxtaco',
            github: 'maxtaco',
            hackernews: 'maxtaco',
            reddit: 'maxtaco',
            twitter: 'maxtaco',
          }}
          followingState={'NotFollowing' as const}
          highlight={false}
          inTeam={false}
          isPreExistingTeamMember={true}
          onAdd={Sb.action('onAdd')}
          onRemove={Sb.action('onRemove')}
        />
      </>
    ))
    .add('OLD - Chris', () => (
      <UserResult
        username="chris"
        prettyName="Chris Coyne"
        displayLabel="Chris Coyne"
        highlight={false}
        resultForService="keybase"
        services={{
          facebook: 'chriscoyne on Facebook',
          github: 'malgorithms on GitHub',
          hackernews: 'malgorithms on HackerNews',
          keybase: 'malgorithms',
          reddit: 'malgorithms on Reddit',
          twitter: 'malgorithms on Twitter',
        }}
        inTeam={false}
        isPreExistingTeamMember={false}
        followingState={'Following' as const}
        onAdd={Sb.action('onAdd')}
        onRemove={Sb.action('onRemove')}
      />
    ))
    .add('OLD - Chris (already in team)', () => (
      <UserResult
        username="chris"
        prettyName="Chris Coyne"
        displayLabel="Chris Coyne"
        highlight={false}
        resultForService="keybase"
        services={{
          facebook: 'chriscoyne on Facebook',
          github: 'malgorithms on GitHub',
          hackernews: 'malgorithms on HackerNews',
          reddit: 'malgorithms on Reddit',
          twitter: 'malgorithms on Twitter',
        }}
        inTeam={true}
        isPreExistingTeamMember={false}
        followingState={'Following' as const}
        onAdd={Sb.action('onAdd')}
        onRemove={Sb.action('onRemove')}
      />
    ))
    .add('OLD - marcopolo (github) - keybase user. following', () => (
      <UserResult
        resultForService="github"
        username="marcopolo"
        prettyName=""
        displayLabel=""
        highlight={false}
        services={{github: 'marcopolo', keybase: 'marcopolo'}}
        inTeam={true}
        isPreExistingTeamMember={false}
        followingState={'Following' as const}
        onAdd={Sb.action('onAdd')}
        onRemove={Sb.action('onRemove')}
      />
    ))
    .add('OLD - marcopolo2 (github) - no keybase user', () => (
      <UserResult
        resultForService="github"
        username="marcopolo"
        prettyName=""
        displayLabel=""
        highlight={false}
        services={{github: 'marcopolo'}}
        inTeam={true}
        followingState={'NoState' as const}
        onAdd={Sb.action('onAdd')}
        onRemove={Sb.action('onRemove')}
        isPreExistingTeamMember={false}
      />
    ))
    .add('OLD - Chris Highlighted (already in team)', () => (
      <UserResult
        isPreExistingTeamMember={false}
        username="chris"
        prettyName="Chris Coyne"
        displayLabel="Chris Coyne"
        services={{
          facebook: 'chriscoyne on Facebook',
          github: 'malgorithms on GitHub',
          hackernews: 'malgorithms on HackerNews',
          reddit: 'malgorithms on Reddit',
          twitter: 'malgorithms on Twitter',
        }}
        inTeam={true}
        followingState={'Following' as const}
        onAdd={Sb.action('onAdd')}
        onRemove={Sb.action('onRemove')}
        highlight={true}
        resultForService="keybase"
      />
    ))

  Sb.storiesOf('Team-Building/Phone Search', module).add('Empty Phone Search', () => (
    <PhoneSearch
      continueLabel="Continue"
      namespace="chat2"
      search={Sb.action('search')}
      teamBuildingSearchResults={{}}
    />
  ))

  emailSearch()
}

export default load
