// @flow
import * as React from 'react'
import {Box2} from '../../common-adapters'
import {action, storiesOf, createPropProvider} from '../../stories/storybook'
import Search from '.'
import {makeSelectorMap as makeResultsListSelectorMap} from '../../search/results-list/index.stories'
import {type UserDetails} from '../../search/user-input'
import {makeSelectorMap as makeUserInputSelectorMap} from '../../search/user-input/index.stories'

const Wrapper = ({children}) => (
  <Box2 direction="vertical" style={{height: 580, minWidth: 640}}>
    {children}
  </Box2>
)

const selectedUser: UserDetails = {
  followingState: 'Following',
  icon: null,
  id: 'chris',
  service: 'Keybase',
  username: 'chris',
}

const provider = createPropProvider({
  ...makeResultsListSelectorMap(),
  ...makeUserInputSelectorMap([selectedUser]),
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
