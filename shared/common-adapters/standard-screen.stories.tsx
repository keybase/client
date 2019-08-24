import * as React from 'react'
import * as Styles from '../styles'
import StandardScreen from './standard-screen'
import Text from './text'
import Box from './box'
import {action, storiesOf} from '../stories/storybook'

const Kb = {
  Box,
  StandardScreen,
  Text,
}

const Wrapper = ({children}) => (
  <Kb.Box style={{...Styles.globalStyles.flexBoxRow, height: 578}}>{children}</Kb.Box>
)
const props = {
  children: (
    <Kb.Text center={true} type="Header">
      Whoa, look at this centered thing
    </Kb.Text>
  ),
  onClose: action('onClose'),
}

const load = () => {
  storiesOf('Common/StandardScreen', module)
    .add('Normal', () => <Kb.StandardScreen {...props} />)
    .add('Error', () => (
      <Wrapper>
        <Kb.StandardScreen
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
        <Kb.StandardScreen {...props} onClose={undefined} onBack={action('onBack')} />
      </Wrapper>
    ))
    .add('Error w/ Back Button', () => (
      <Wrapper>
        <Kb.StandardScreen
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
