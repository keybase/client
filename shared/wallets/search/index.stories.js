// @flow
import * as React from 'react'
import {Box2} from '../../common-adapters'
import {action, storiesOf, createPropProvider} from '../../stories/storybook'
import Search from '.'
import {makeSelectorMap as makeResultsListSelectorMap} from '../../search/results-list/index.stories'
import {makeSelectorMap as makeUserInputSelectorMap} from '../../search/user-input/index.stories'

const Wrapper = ({children}) => (
  <Box2 direction="vertical" style={{height: 580, minWidth: 640}}>
    {children}
  </Box2>
)

const provider = createPropProvider({
  ...makeResultsListSelectorMap(),
  ...makeUserInputSelectorMap(),
})

const load = () => {
  storiesOf('Wallets/Search', module)
    .addDecorator(provider)
    .add('Normal', () => (
      <Wrapper>
        <Search onClick={action('onClick')} onClose={action('onClose')} />
      </Wrapper>
    ))
}

export default load
