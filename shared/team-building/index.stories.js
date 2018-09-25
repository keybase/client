// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import * as Kb from '../common-adapters'
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

const OutlineWrapper = ({style, children}: any) => (
  <Kb.Box2
    direction="vertical"
    style={{
      ...style,
      border: 'solid',
      borderWidth: 1,
      borderColor: 'black',
      borderRadius: 3,
    }}
  >
    {children}
  </Kb.Box2>
)

const load = () => {
  Sb.storiesOf('Team-Building', module)
    .addDecorator(provider)
    .add('Team Building', () => (
      <OutlineWrapper style={{marginTop: 20, width: 460, height: 434}}>
        <TeamBuilding
          selectedService="keybase"
          onChangeService={Sb.action('onChangeService')}
          onFinishTeamBuilding={Sb.action('onFinishTeamBuilding')}
          clearTextTrigger={0}
          onChangeText={Sb.action('onChangeText')}
          onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
          onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
          onEnterKeyDown={Sb.action('onEnterKeyDown')}
          onBackspace={Sb.action('onBackspace')}
          onRemove={Sb.action('onRemove')}
          teamSoFar={[
            {
              username: 'max',
              prettyName: 'max (Max Krohn)',
              service: 'keybase',
              userId: 'max',
            },
            {
              username: 'marcopolo',
              prettyName: 'marcopolo (GitHub)',
              service: 'github',
              userId: 'marcopolo@github',
            },
            {
              username: 'chris',
              prettyName: 'chris (Chris Coyne)',
              service: 'keybase',
              userId: 'chris',
            },
          ]}
          serviceResultCount={{}}
          showServiceResultCount={false}
          onAdd={Sb.action('onAdd')}
          highlightedIndex={1}
          searchResults={[
            {
              userId: 'chris',
              username: 'chris',
              prettyName: 'Chris Coyne',
              services: {
                facebook: 'chriscoyne on Facebook',
                github: 'malgorithms on GitHub',
                hackernews: 'malgorithms on HackerNews',
                reddit: 'malgorithms on Reddit',
                twitter: 'malgorithms on Twitter',
              },
              inTeam: true,
              followingState: 'Following',
            },
            {
              userId: 'chrismikacle',
              username: 'chrismikacle',
              prettyName: 'Chris Mikacle',
              services: {
                github: 'chrismikacle on GitHub',
                hackernews: 'chrismikacle on HackerNews',
                reddit: 'chrismikacle on Reddit',
                twitter: 'chrismikacle on Twitter',
              },
              inTeam: false,
              followingState: 'NotFollowing',
            },
            {
              userId: 'chrisnojima',
              username: 'chrisnojima',
              prettyName: 'Chris Nojima',
              services: {
                github: 'cnojima on GitHub',
                hackernews: 'cnojima on HackerNews',
                reddit: 'cnojima on Reddit',
                twitter: 'cnojima on Twitter',
              },
              inTeam: false,
              followingState: 'Following',
            },
          ]}
        />
      </OutlineWrapper>
    ))

    .add('Input', () => (
      <Input
        clearTextTrigger={0}
        onChangeText={Sb.action('onChangeText')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
        onBackspace={Sb.action('onBackspace')}
      />
    ))
    .add('TeamBox', () => (
      <TeamBox
        onChangeText={Sb.action('onChangeText')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
        onBackspace={Sb.action('onBackspace')}
        onRemove={Sb.action('onRemove')}
        clearTextTrigger={0}
        teamSoFar={[
          {
            username: 'max',
            prettyName: 'max (Max Krohn)',
            service: 'keybase',
            userId: 'max',
          },
          {
            username: 'marcopolo',
            prettyName: 'marcopolo (GitHub)',
            service: 'github',
            userId: 'marcopolo@github',
          },
        ]}
      />
    ))
    .add('Go Button', () => <GoButton onClick={Sb.action('onClick')} />)

  Sb.storiesOf('Team-Building/User Bubble', module)
    .addDecorator(provider)
    .add('Plain', () => (
      <UserBubble
        username={'max'}
        prettyName={'max (Max Krohn)'}
        service={'keybase'}
        onRemove={Sb.action('onRemove')}
      />
    ))
    .add('GitHub', () => (
      <UserBubble
        username={'marcopolo'}
        prettyName={'marcopolo (GitHub)'}
        service={'github'}
        onRemove={Sb.action('onRemove')}
      />
    ))

  Sb.storiesOf('Team-Building/Service Tab Bar', module)
    .add('Plain', () => (
      <ServiceTabBar
        selectedService="keybase"
        onChangeService={Sb.action('onChangeService')}
        serviceResultCount={{}}
        showServiceResultCount={false}
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

  Sb.storiesOf('Team-Building/User Result', module)
    .addDecorator(provider)
    .add('Chris', () => (
      <UserResult
        username="chris"
        prettyName="Chris Coyne"
        highlight={false}
        services={{
          facebook: 'chriscoyne on Facebook',
          github: 'malgorithms on GitHub',
          hackernews: 'malgorithms on HackerNews',
          reddit: 'malgorithms on Reddit',
          twitter: 'malgorithms on Twitter',
        }}
        inTeam={false}
        followingState={'Following'}
        onAdd={Sb.action('onAdd')}
        onRemove={Sb.action('onRemove')}
        p={true}
        onMouseOver={Sb.action('onMouseOver')}
        onMouseLeave={Sb.action('onMouseLeave')}
      />
    ))
    .add('Chris (already in team)', () => (
      <UserResult
        username="chris"
        prettyName="Chris Coyne"
        highlight={false}
        services={{
          facebook: 'chriscoyne on Facebook',
          github: 'malgorithms on GitHub',
          hackernews: 'malgorithms on HackerNews',
          reddit: 'malgorithms on Reddit',
          twitter: 'malgorithms on Twitter',
        }}
        inTeam={true}
        followingState={'Following'}
        onAdd={Sb.action('onAdd')}
        onRemove={Sb.action('onRemove')}
        onMouseOver={Sb.action('onMouseOver')}
        onMouseLeave={Sb.action('onMouseLeave')}
      />
    ))
    .add('Chris Highlighted (already in team)', () => (
      <UserResult
        username="chris"
        prettyName="Chris Coyne"
        services={{
          facebook: 'chriscoyne on Facebook',
          github: 'malgorithms on GitHub',
          hackernews: 'malgorithms on HackerNews',
          reddit: 'malgorithms on Reddit',
          twitter: 'malgorithms on Twitter',
        }}
        inTeam={true}
        followingState={'Following'}
        onAdd={Sb.action('onAdd')}
        onRemove={Sb.action('onRemove')}
        highlight={true}
      />
    ))
}

export default load
