import * as React from 'react'
import StandardScreen from './standard-screen'
import Text from './text'
import Box from './box'
import {action, storiesOf} from '../stories/storybook'
import {globalStyles} from '../styles'

const Wrapper = ({children}) => <Box style={{...globalStyles.flexBoxRow, height: 578}}>{children}</Box>
const props = {
  children: (
    <Text center={true} type="Header">
      Whoa, look at this centered thing
    </Text>
  ),
  onClose: action('onClose'),
}

const load = () => {
  storiesOf('Common/StandardScreen', module)
    .add('Normal', () => <StandardScreen {...props} />)
    .add('Error', () => (
      <Wrapper>
        <StandardScreen
          {...props}
          notification={{
            message: 'Something went horribly wrong! :-(',
            type: 'error',
          }}
        />
      </Wrapper>
    ))
    .add('Back Button', () => (
      <Wrapper>
        <StandardScreen {...props} onClose={undefined} onBack={action('onBack')} />
      </Wrapper>
    ))
    .add('Error w/ Back Button', () => (
      <Wrapper>
        <StandardScreen
          {...props}
          onClose={undefined}
          onBack={action('onBack')}
          notification={{
            message: 'This is an error, but you can go back!',
            type: 'error',
          }}
        />
      </Wrapper>
    ))
}

export default load
