// @flow
import * as React from 'react'
import StandardScreen from './standard-screen'
import Text from './text'
import Box from './box'
import {action, storiesOf} from '../stories/storybook'
import {globalStyles, globalColors} from '../styles'

const Wrapper = ({children}) => <Box style={{...globalStyles.flexBoxRow, height: 578}}>{children}</Box>
const props = {
  onClose: action('onClose'),
  children: (
    <Text type="Header" style={{textAlign: 'center'}}>
      Whoa, look at this centered thing
    </Text>
  ),
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
    .add('Success w/ Custom Notification Element', () => (
      <Wrapper>
        <StandardScreen
          {...props}
          notification={{
            message: (
              <Text type="BodySemibold" style={{color: globalColors.white}}>
                You won a unicorn!{' '}
                <Text type="BodySemibold" style={{color: globalColors.white}}>
                  Make sure to feed it
                </Text>{' '}
                :-)
              </Text>
            ),
            type: 'success',
          }}
        />
      </Wrapper>
    ))
    .add('Back Button', () => (
      <Wrapper>
        <StandardScreen {...props} onClose={null} onBack={action('onBack')} />
      </Wrapper>
    ))
    .add('Error w/ Back Button', () => (
      <Wrapper>
        <StandardScreen
          {...props}
          onClose={null}
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
