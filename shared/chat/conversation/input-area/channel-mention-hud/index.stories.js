// @flow
import React from 'react'
import * as I from 'immutable'
import {MentionRowRenderer, MentionHud} from '.'
import {compose, withStateHandlers} from '../../../../util/container'
import {Box, Button, Input, ButtonBar} from '../../../../common-adapters'
import {createPropProvider, storiesOf, action} from '../../../../stories/storybook'
import {globalStyles} from '../../../../styles'

const provider = createPropProvider({
  ChannelMentionHud: props => ({
    ...props,
    following: I.Set(),
    you: 'chris',
    data: props.channels
      ? Object.keys(props.channels)
          .filter(c => c.toLowerCase().indexOf(props.filter) >= 0)
          .sort()
          .map((c, i) => ({channelName: c, selected: i === props.selectedIndex}))
      : {},
  }),
})

const UpDownFilterHoc = compose(
  withStateHandlers(
    {
      downCounter: 0,
      filter: '',
      upCounter: 0,
    },
    {
      // $FlowIssue
      setDownCounter: () => (downCounter: number) => ({downCounter}),
      // $FlowIssue
      setFilter: () => (filter: string) => ({filter}),
      // $FlowIssue
      setUpCounter: () => (upCounter: number) => ({upCounter}),
    }
  ),
  Component => props => (
    <Box style={globalStyles.flexBoxColumn}>
      <Component upCounter={props.upCounter} downCounter={props.downCounter} filter={props.filter} />
      <ButtonBar>
        <Button label="Up" type="Primary" onClick={() => props.setUpCounter(props.upCounter + 1)} />
        <Button label="Down" type="Primary" onClick={() => props.setDownCounter(props.downCounter + 1)} />
      </ButtonBar>
      <Input onChangeText={props.setFilter} hintText="Filter" />
    </Box>
  )
)

const load = () => {
  storiesOf('Chat/Channel Heads up Display', module)
    .addDecorator(provider)
    .add('Mention Row', () => (
      <Box style={{width: 240}}>
        <MentionRowRenderer
          channelName="foo"
          key="foo"
          selected={false}
          onClick={action('onClick')}
          onHover={action('onHover')}
        />
        <MentionRowRenderer
          channelName="bar"
          key="bar"
          selected={true}
          onClick={action('onClick')}
          onHover={action('onHover')}
        />
        <MentionRowRenderer
          channelName="baz"
          key="baz"
          selected={false}
          onClick={action('onClick')}
          onHover={action('onHover')}
        />
      </Box>
    ))
    .add('Mention Hud', () => {
      const Hud = UpDownFilterHoc(({upCounter, downCounter, filter}) => (
        <Box style={{...globalStyles.flexBoxColumn, height: 100, width: 240}}>
          <MentionHud
            channels={['foo', 'bar', 'baz']}
            onPickChannel={action('onPickChannel')}
            onSelectChannel={action('onSelectChannel')}
            selectUpCounter={upCounter}
            selectDownCounter={downCounter}
            pickSelectedUserCounter={0}
            filter={filter}
            style={{flex: 1}}
          />
        </Box>
      ))
      return <Hud />
    })
}

export default load
