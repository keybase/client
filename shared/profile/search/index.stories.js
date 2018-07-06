// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import {Box2} from '../../common-adapters'
import {action, storiesOf, createPropProvider} from '../../stories/storybook'
import Search from '.'

const Wrapper = ({children}) => (
  <Box2 direction="vertical" style={{height: 580, minWidth: 640}}>
    {children}
  </Box2>
)

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

const props = {
  disableIfInTeamName: '',
  items: Object.keys(servicesResultsListMapCommonRows),
  onClick: () => action('onClick'),
  onShowTracker: () => action('onShowTracker'),
  selectedId: null,
  showSearchSuggestions: false,
  keyPath: ['searchChat'],
}

const inputCommon = {
  autoFocus: false,
  onAddSelectedUser: action('Add selected user'),
  onCancel: action('Cancel'),
  onChangeText: action('Change text'),
  onClearSearch: action('Clear search'),
  onClickAddButton: action('Add button click'),
  onEnterEmptyText: action('onEnterEmptyText'),
  onMoveSelectDown: action('Move select down'),
  onMoveSelectUp: action('Move select up'),
  onRemoveUser: action('Remove user'),
  placeholder: 'Type someone',
  selectedSearchId: null,

  userItems: [],
  usernameText: '',

  search: action('search'),
}

const provider = createPropProvider(PropProviders.Common(), {
  SearchResultRow: (props: {id: string}) => servicesResultsListMapCommonRows[props.id],
  Chooser: () => {
    return props
  },
  UserInput: () => {
    return inputCommon
  },
})

const load = () => {
  storiesOf('Profile/Search', module)
    .addDecorator(provider)
    .add('Normal', () => (
      <Wrapper>
        <Search onClick={action('onClick')} onClose={action('onClose')} />
      </Wrapper>
    ))
}

export default load
