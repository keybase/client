// @flow
import * as React from 'react'
import ResultsList from '.'
import {Box} from '../../common-adapters'
import {storiesOf, action, createPropProvider} from '../../stories/storybook'
import * as PropProviders from '../../stories/prop-providers'
import {type ConnectPropsMap, makeSelectorMap} from '../result-row/index.stories'

const connectPropsMap: ConnectPropsMap = {
  chris: {
    leftFullname: 'chris on GitHub',
    leftIcon: null,
    leftService: 'Keybase',
    leftUsername: 'chris',

    rightIcon: 'iconfont-identity-github',
    rightService: 'GitHub',
    rightUsername: 'chrisname',

    leftFollowingState: 'Following',
    rightFollowingState: 'NoState',
    userIsInTeam: false,
  },
  cjb: {
    leftFullname: 'cjb on facebook',
    leftIcon: null,
    leftService: 'Keybase',
    leftUsername: 'cjb',

    rightIcon: 'iconfont-identity-facebook',
    rightService: 'Facebook',
    rightUsername: 'cjbname',

    leftFollowingState: 'NotFollowing',
    rightFollowingState: 'NoState',
    userIsInTeam: false,
  },
  jzila: {
    leftFullname: 'jzila on twitter',
    leftIcon: null,
    leftService: 'Keybase',
    leftUsername: 'jzila',

    rightIcon: 'iconfont-identity-twitter',
    rightService: 'Twitter',
    rightUsername: 'jzilatwit',

    leftFollowingState: 'NotFollowing',
    rightFollowingState: 'NoState',
    userIsInTeam: false,
  },
}

Object.keys(connectPropsMap).forEach(id => {
  connectPropsMap[id + '-fb'] = {
    ...connectPropsMap[id],
    leftFollowingState: 'NoState',
    leftIcon: 'icon-facebook-logo-24',
    leftService: 'Facebook',
  }
})

const provider = createPropProvider(PropProviders.Common(), makeSelectorMap(connectPropsMap))

const props = {
  disableIfInTeamName: '',
  items: Object.keys(connectPropsMap),
  onClick: () => action('onClick'),
  onShowTracker: () => action('onShowTracker'),
  selectedId: null,
  showSearchSuggestions: false,
}

const Wrapper = ({children}) => <Box style={{width: 420}}>{children}</Box>

const load = () => {
  storiesOf('Search/ResultsList', module)
    .addDecorator(provider)
    .add('keybaseResults', () => (
      <Wrapper>
        <ResultsList {...props} items={['chris', 'cjb', 'jzila']} keyPath={['searchChat']} />
      </Wrapper>
    ))
    .add('keybaseResultsOne', () => (
      <Wrapper>
        <ResultsList {...props} items={['chris']} keyPath={['searchChat']} />
      </Wrapper>
    ))
    .add('facebookResults', () => (
      <Wrapper>
        <ResultsList {...props} items={['chris-fb', 'cjb-fb', 'jzila-fb']} keyPath={['searchChat']} />
      </Wrapper>
    ))
    .add('noResults', () => (
      <Wrapper>
        <ResultsList {...props} items={[]} keyPath={['searchChat']} />
      </Wrapper>
    ))
}

export default load
