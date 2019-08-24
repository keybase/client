import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Box2} from '../../common-adapters'
import Search from '.'
import {makeSelectorMap as makeResultsListSelectorMap} from '../../search/results-list/index.stories'
import {makeSelectorMap as makeUserInputSelectorMap} from '../../search/user-input/index.stories'

const Wrapper = ({children}) => (
  <Box2 direction="vertical" style={{height: 580, minWidth: 640}}>
    {children}
  </Box2>
)

export const Provider = Sb.createPropProviderWithCommon({
  ...makeResultsListSelectorMap(),
  ...makeUserInputSelectorMap([]),
  PeopleTabSearch: (props: any) => ({
    ...props,
    onSearch: Sb.action('onSearch'),
  }),
})

const load = () => {
  Sb.storiesOf('Profile/Search', module)
    .addDecorator(Provider)
    .add('Normal', () => (
      <Wrapper>
        <Search onClick={Sb.action('onClick')} onClose={Sb.action('onClose')} />
      </Wrapper>
    ))
}

export default load
