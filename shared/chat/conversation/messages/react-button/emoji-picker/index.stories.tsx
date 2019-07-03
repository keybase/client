import * as React from 'react'
import {Box, Box2, NewInput} from '../../../../../common-adapters'
import {action, storiesOf} from '../../../../../stories/storybook'
import ChooseEmoji from '.'
import {defaultTopReacjis} from '../../../../../constants/chat2'

class WithFilter extends React.Component<
  {topReacjis: Array<string>},
  {
    filter: string
  }
> {
  state = {filter: ''}
  render() {
    return (
      <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <NewInput onChangeText={filter => this.setState({filter})} />
        <ChooseEmoji
          onChoose={action('onChoose')}
          width={300}
          filter={this.state.filter}
          topReacjis={this.props.topReacjis}
        />
      </Box2>
    )
  }
}

const load = () =>
  storiesOf('Chat/Emoji picker', module)
    .addDecorator(story => <Box style={{height: 400, overflow: 'hidden', width: 300}}>{story()}</Box>)
    .add('Default', () => (
      <ChooseEmoji onChoose={action('onChoose')} width={300} topReacjis={defaultTopReacjis} />
    ))
    .add('Custom filter', () => <WithFilter topReacjis={defaultTopReacjis} />)
    .add('No top reacjis', () => <WithFilter topReacjis={[]} />)

export default load
