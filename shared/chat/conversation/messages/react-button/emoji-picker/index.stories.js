// @flow
import * as React from 'react'
import {Box, Box2, NewInput} from '../../../../../common-adapters'
import {action, storiesOf} from '../../../../../stories/storybook'
import ChooseEmoji from '.'

const filters = ['smile', 'flag', 'firework', 'sad', 'e']

class WithFilter extends React.Component<{}, {filter: string}> {
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

const load = () => {
  const story = storiesOf('Chat/Emoji picker', module)
    .addDecorator(story => <Box style={{height: 400, overflow: 'hidden', width: 300}}>{story()}</Box>)
    .add('Default', () => <ChooseEmoji onChoose={action('onChoose')} width={300} />)
    .add('Custom filter', () => <WithFilter />)
  filters.forEach(f =>
    story.add(`Filter: ${f}`, () => <ChooseEmoji onChoose={action('onChoose')} width={300} filter={f} />)
  )
}

export default load
