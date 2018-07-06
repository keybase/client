// @flow
import * as React from 'react'
import {Box2} from '../../common-adapters'
import {action, storiesOf, createPropProvider} from '../../stories/storybook'
import Search from '.'
import {makeSelectorMap as makeResultsListSelectorMap} from '../../search/results-list/index.stories'

const Wrapper = ({children}) => (
  <Box2 direction="vertical" style={{height: 580, minWidth: 640}}>
    {children}
  </Box2>
)

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

const provider = createPropProvider({
  ...makeResultsListSelectorMap(),
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
