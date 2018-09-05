// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import UserBubble from './user-bubble'
import Hello from './index'
import Input from './input'
import TeamBox from './team-box'
import GoButton from './go-button'
import ServiceTabBar from './service-tab-bar'

const provider = Sb.createPropProviderWithCommon(
  Sb.PropProviders.Avatar(['following', 'both'], ['followers', 'both'])
)

const commonProps = {}
const load = () => {
  Sb.storiesOf('Team-Building', module)
    .addDecorator(provider)
    .add('Hello', () => <Hello />)
    .add('Input', () => (
      <Input
        onChangeText={Sb.action('onChangeText')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
        onBackspaceWhileEmpty={Sb.action('onBackspaceWhileEmpty')}
      />
    ))
    .add('UserBubble', () => (
      <UserBubble
        username={'max'}
        prettyName={'max (Max Krohn)'}
        service={'keybase'}
        onRemove={Sb.action('onRemove')}
      />
    ))
    .add('UserBubble - github', () => (
      <UserBubble
        username={'marcopolo'}
        prettyName={'marcopolo (GitHub)'}
        service={'github'}
        onRemove={Sb.action('onRemove')}
      />
    ))
    .add('TeamBox', () => (
      <TeamBox
        onChangeText={Sb.action('onChangeText')}
        onDownArrowKeyDown={Sb.action('onDownArrowKeyDown')}
        onUpArrowKeyDown={Sb.action('onUpArrowKeyDown')}
        onEnterKeyDown={Sb.action('onEnterKeyDown')}
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
        ]}
      />
    ))
    .add('Go Button', () => <GoButton onClick={Sb.action('onClick')} />)

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
}

export default load
