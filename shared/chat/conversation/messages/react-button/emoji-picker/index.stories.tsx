import * as React from 'react'
import * as RPCTypes from '../../../../../constants/types/rpc-gen'
import {Box, Box2, NewInput} from '../../../../../common-adapters'
import {action, storiesOf} from '../../../../../stories/storybook'
import ChooseEmoji from '.'
import {defaultTopReacjis} from '../../../../../constants/chat2'

class WithFilter extends React.Component<
  {topReacjis: Array<RPCTypes.UserReacji>},
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
          addEmoji={action('addEmoji')}
          onChoose={action('onChoose')}
          width={300}
          filter={this.state.filter}
          topReacjis={this.props.topReacjis}
          hideFrequentEmoji={false}
        />
      </Box2>
    )
  }
}

const load = () =>
  storiesOf('Chat/Emoji picker', module)
    .addDecorator(story => <Box style={{height: 400, overflow: 'hidden', width: 300}}>{story()}</Box>)
    .add('Default', () => (
      <ChooseEmoji
        addEmoji={action('addEmoji')}
        onChoose={action('onChoose')}
        width={300}
        topReacjis={defaultTopReacjis}
        hideFrequentEmoji={false}
      />
    ))
    .add('Custom filter', () => <WithFilter topReacjis={defaultTopReacjis} />)
    .add('No top reacjis', () => <WithFilter topReacjis={[]} />)

export default load
