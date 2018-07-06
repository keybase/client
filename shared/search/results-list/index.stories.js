// @flow
import * as React from 'react'
import ResultsList from '.'
import {Box} from '../../common-adapters'
import {storiesOf, action, createPropProvider} from '../../stories/storybook'
import * as PropProviders from '../../stories/prop-providers'

const provider = createPropProvider(PropProviders.Common(), {
  SearchResultRow: (props: {id: string}) => servicesResultsListMapCommonRows[props.id],
})

const commonServicesResultMapPropsKB = {
  id: '0',
  leftFollowingState: 'NoState',
  leftFullname: 'John Zila',
  leftIcon: 'jzila',
  leftService: 'Keybase',
  leftUsername: 'jzila',
  onShowTracker: () => action('showtracker'),
  rightFollowingState: 'NoState',
  rightIcon: null,
  rightService: null,
  rightUsername: null,
}

const servicesResultsListMapCommonRows = {
  chris: {
    ...commonServicesResultMapPropsKB,
    leftFollowingState: 'Following',
    leftFullname: 'chris on GitHub',
    leftUsername: 'chris',
    rightIcon: 'iconfont-identity-github',
    rightService: 'GitHub',
    rightUsername: 'chrisname',
  },
  cjb: {
    ...commonServicesResultMapPropsKB,
    leftFollowingState: 'NotFollowing',
    leftFullname: 'cjb on facebook',
    leftUsername: 'cjb',
    rightIcon: 'iconfont-identity-facebook',
    rightService: 'Facebook',
    rightUsername: 'cjbname',
  },
  jzila: {
    ...commonServicesResultMapPropsKB,
    leftFollowingState: 'NoState',
    leftFullname: 'jzila on twitter',
    leftUsername: 'jzila',
    rightIcon: 'iconfont-identity-twitter',
    rightService: 'Twitter',
    rightUsername: 'jzilatwit',
  },
}

Object.keys(servicesResultsListMapCommonRows).forEach(name => {
  servicesResultsListMapCommonRows[name + '-fb'] = {
    ...servicesResultsListMapCommonRows[name],
    leftFollowingState: 'NoState',
    leftIcon: 'icon-facebook-logo-24',
    leftService: 'Facebook',
  }
})

const props = {
  disableIfInTeamName: '',
  items: Object.keys(servicesResultsListMapCommonRows),
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
