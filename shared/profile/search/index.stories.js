// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import {Box2} from '../../common-adapters'
import {action, storiesOf} from '../../stories/storybook'
import Search from '.'

const Wrapper = ({children}) => (
  <Box2 direction="vertical" style={{height: 580, minWidth: 640}}>
    {children}
  </Box2>
)

const provider = PropProviders.CommonProvider()

const load = () => {
  storiesOf('Profile/Search', module)
    .addDecorator(provider)
    .add('Normal', () => (
      <Wrapper>
        <Search
          onClick={action('onClick')}
          showAddButton={false}
          onClose={action('onClose')}
          placeholder="placeholder"
          navigateUp={action('navigateUp')}
        />
      </Wrapper>
    ))
}

export default load
