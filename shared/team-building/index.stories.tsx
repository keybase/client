import * as React from 'react'
import * as Sb from '../stories/storybook'
import * as Types from '../constants/types/team-building'
import UserBubble from './user-bubble'
import TeamBuilding from './index'
import Input from './input'
import TeamBox from './team-box'
import GoButton from './go-button'
import ServiceTabBar from './service-tab-bar'
import UserResult from './user-result'

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

const contactProps = {
  contactsImported: false,
  contactsPermissionStatus: 'granted',
  isImportPromptDismissed: false,
  numContactsImported: 0,
  onAskForContactsLater: Sb.action('onAskForContactsLater'),
  onImportContacts: Sb.action('onImportContacts'),
  onLoadContactsSetting: Sb.action('onLoadContactsSetting'),
}

const load = () => {
  Sb.storiesOf('Team-Building', module)
    .addDecorator(provider)
    .add('Team Building', () => (
      <TeamBuilding
        {...contactProps}
        includeContacts={true}
        searchString="chris"
        selectedService="keybase"
        waitingForCreate={false}
        onChangeService={Sb.action('onChangeService')}
        onFinishTeamBuilding={Sb.action('onFinishTeamBuilding')}
        onChangeText={Sb.action('onChangeText')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
        onBackspace={Sb.action('onBackspace')}
        onRemove={Sb.action('onRemove')}
        onMakeItATeam={Sb.action('onMakeItATeam')}
        showRecs={false}
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
        showServiceResultCount={false}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
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
      />
    ))
    .add('Team Building - No search string', () => (
      <TeamBuilding
        {...contactProps}
        includeContacts={true}
        searchString=""
        selectedService="keybase"
        waitingForCreate={false}
        onChangeService={Sb.action('onChangeService')}
        onFinishTeamBuilding={Sb.action('onFinishTeamBuilding')}
        onChangeText={Sb.action('onChangeText')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
        onBackspace={Sb.action('onBackspace')}
        onRemove={Sb.action('onRemove')}
        onMakeItATeam={Sb.action('onMakeItATeam')}
        showRecs={false}
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
        showServiceResultCount={false}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
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
      />
    ))
    .add('Team Building - Show role picker', () => (
      <TeamBuilding
        includeContacts={true}
        {...contactProps}
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
        onChangeService={Sb.action('onChangeService')}
        onFinishTeamBuilding={Sb.action('onFinishTeamBuilding')}
        onChangeText={Sb.action('onChangeText')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
        onBackspace={Sb.action('onBackspace')}
        onRemove={Sb.action('onRemove')}
        onMakeItATeam={Sb.action('onMakeItATeam')}
        showRecs={false}
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
        showServiceResultCount={false}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
        searchResults={[]}
      />
    ))
    .add('Team Building - No search string or results', () => (
      <TeamBuilding
        {...contactProps}
        includeContacts={true}
        searchString=""
        selectedService="keybase"
        waitingForCreate={false}
        onChangeService={Sb.action('onChangeService')}
        onFinishTeamBuilding={Sb.action('onFinishTeamBuilding')}
        onChangeText={Sb.action('onChangeText')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
        onBackspace={Sb.action('onBackspace')}
        onRemove={Sb.action('onRemove')}
        onMakeItATeam={Sb.action('onMakeItATeam')}
        showRecs={false}
        recommendations={[]}
        fetchUserRecs={() => {}}
        onSearchForMore={() => {
          Sb.action('onSearchForMore')
        }}
        teamSoFar={[]}
        searchResults={[]}
        serviceResultCount={{}}
        showServiceResultCount={false}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
      />
    ))
    .add('Team Building - One line of users', () => (
      <TeamBuilding
        {...contactProps}
        includeContacts={true}
        searchString="chris"
        selectedService="keybase"
        waitingForCreate={false}
        onChangeService={Sb.action('onChangeService')}
        onFinishTeamBuilding={Sb.action('onFinishTeamBuilding')}
        onChangeText={Sb.action('onChangeText')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
        onBackspace={Sb.action('onBackspace')}
        onRemove={Sb.action('onRemove')}
        onMakeItATeam={Sb.action('onMakeItATeam')}
        showRecs={false}
        recommendations={[]}
        fetchUserRecs={() => {}}
        onSearchForMore={() => {
          Sb.action('onSearchForMore')
        }}
        teamSoFar={generateTeamSofar(9)}
        serviceResultCount={{}}
        showServiceResultCount={false}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
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
      />
    ))
    .add('Team Building - One line of users + 1', () => (
      <TeamBuilding
        {...contactProps}
        includeContacts={true}
        searchString="chris"
        selectedService="keybase"
        waitingForCreate={false}
        onChangeService={Sb.action('onChangeService')}
        onFinishTeamBuilding={Sb.action('onFinishTeamBuilding')}
        onChangeText={Sb.action('onChangeText')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
        onBackspace={Sb.action('onBackspace')}
        onRemove={Sb.action('onRemove')}
        onMakeItATeam={Sb.action('onMakeItATeam')}
        showRecs={false}
        recommendations={[]}
        fetchUserRecs={() => {}}
        onSearchForMore={() => {
          Sb.action('onSearchForMore')
        }}
        teamSoFar={generateTeamSofar(10)}
        serviceResultCount={{}}
        showServiceResultCount={false}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
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
      />
    ))
    .add('Team Building - Lotsa users', () => (
      <TeamBuilding
        {...contactProps}
        includeContacts={true}
        searchString="chris"
        selectedService="keybase"
        waitingForCreate={false}
        onChangeService={Sb.action('onChangeService')}
        onFinishTeamBuilding={Sb.action('onFinishTeamBuilding')}
        onChangeText={Sb.action('onChangeText')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
        onBackspace={Sb.action('onBackspace')}
        onRemove={Sb.action('onRemove')}
        onMakeItATeam={Sb.action('onMakeItATeam')}
        showRecs={false}
        recommendations={[]}
        fetchUserRecs={() => {}}
        onSearchForMore={() => {
          Sb.action('onSearchForMore')
        }}
        teamSoFar={generateTeamSofar(100)}
        serviceResultCount={{}}
        showServiceResultCount={false}
        onAdd={Sb.action('onAdd')}
        highlightedIndex={1}
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
      />
    ))

    .add('Input', () => (
      <Input
        hasMembers={false}
        placeholder="Type in some input inside"
        searchString=""
        onChangeText={Sb.action('onChangeText')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
        onBackspace={Sb.action('onBackspace')}
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
    .add('Go Button', () => <GoButton label="Go!" onClick={Sb.action('onClick')} />)

  Sb.storiesOf('Team-Building/User Bubble', module)
    .addDecorator(provider)
    .add('Plain', () => (
      <UserBubble
        username="max"
        prettyName="max (Max Krohn)"
        service="keybase"
        onRemove={Sb.action('onRemove')}
      />
    ))
    .add('GitHub', () => (
      <UserBubble
        username="marcopolo"
        prettyName="marcopolo (GitHub)"
        service="github"
        onRemove={Sb.action('onRemove')}
      />
    ))

  Sb.storiesOf('Team-Building/Service Tab Bar', module)
    .add('With Service Results counts', () => (
      <ServiceTabBar
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
  ]
  servicesToDisplay.forEach(service => {
    Sb.storiesOf('Team-Building/Service Tab Bar', module).add(`${service} selected`, () => (
      <ServiceTabBar
        selectedService={service}
        onChangeService={Sb.action('onChangeService')}
        serviceResultCount={{}}
        showServiceResultCount={false}
      />
    ))
  })

  Sb.storiesOf('Team-Building/User Result', module)
    .addDecorator(provider)
    .add('Chris', () => (
      <UserResult
        username="chris"
        prettyName="Chris Coyne"
        displayLabel="Chris Coyne"
        highlight={false}
        resultForService={'keybase'}
        services={{
          facebook: 'chriscoyne on Facebook',
          github: 'malgorithms on GitHub',
          hackernews: 'malgorithms on HackerNews',
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
    .add('Chris (already in team)', () => (
      <UserResult
        username="chris"
        prettyName="Chris Coyne"
        displayLabel="Chris Coyne"
        highlight={false}
        resultForService={'keybase'}
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
    .add('marcopolo (github) - keybase user. following', () => (
      <UserResult
        resultForService={'github'}
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
    .add('marcopolo2 (github) - no keybase user', () => (
      <UserResult
        resultForService={'github'}
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
    .add('Chris Highlighted (already in team)', () => (
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
        resultForService={'keybase'}
      />
    ))
}

export default load
