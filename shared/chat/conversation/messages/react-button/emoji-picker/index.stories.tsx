import * as React from 'react'
import {Box, Box2, NewInput} from '../../../../../common-adapters'
import {action, storiesOf} from '../../../../../stories/storybook'
import ChooseEmoji from '.'

class WithFilter extends React.Component<
  {},
  {
    filter: string
  }
> {
  state = {filter: ''}
  render() {
    return (
      <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <NewInput onChangeText={filter => this.setState({filter})} />
        <ChooseEmoji onChoose={action('onChoose')} width={300} filter={this.state.filter} />
      </Box2>
    )
  }
}

const load = () =>
  storiesOf('Chat/Emoji picker', module)
    .addDecorator(story => <Box style={{height: 400, overflow: 'hidden', width: 300}}>{story()}</Box>)
    .add('Default', () => <ChooseEmoji onChoose={action('onChoose')} width={300} />)
    .add('Custom filter', () => <WithFilter />)

export default load
