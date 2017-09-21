// @flow
import React from 'react'
import {MentionRowRenderer, MentionHud} from '.'
import {compose, withState} from 'recompose'
import {Box, Avatar, Button, Input} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'
import {globalStyles, globalMargins} from '../../styles'

const dummyStore = {
  getState: () => ({}),
  subscribe: (...args) => {},
  dispatch: (...args) => {},
}

const UpDownFilterHoc = compose(
  withState('upCounter', 'setUpCounter', 0),
  withState('downCounter', 'setDownCounter', 0),
  withState('filter', 'setFilter', ''),
  Component => props => (
    <Box style={globalStyles.flexBoxColumn}>
      <Component upCounter={props.upCounter} downCounter={props.downCounter} filter={props.filter} />
      <Box style={globalStyles.flexBoxRow}>
        <Button label="Up" type="Primary" onClick={() => props.setUpCounter(n => n + 1)} />
        <Button
          label="Down"
          type="Primary"
          onClick={() => props.setDownCounter(n => n + 1)}
          style={{marginLeft: globalMargins.small}}
        />
      </Box>
      <Input onChangeText={props.setFilter} hintText="Filter" />
    </Box>
  )
)

const load = () => {
  storiesOf('Chat/Heads up Display', module)
    .add('Mention Row', () => (
      <Box style={{width: 240}}>
        <MentionRowRenderer
          avatar={<Avatar username="marcopolo" size={16} />}
          username="trex"
          fullName="T. Bone Rexasaurus"
          key="trex"
          selected={false}
          onClick={action('onClick')}
          onHover={action('onHover')}
        />
        <MentionRowRenderer
          avatar={<Avatar username="marcopolo" size={16} />}
          username="marcopolo"
          fullName="Marco Munizaga"
          key="marcopolo"
          selected={true}
          onClick={action('onClick')}
          onHover={action('onHover')}
        />
        <MentionRowRenderer
          avatar={<Avatar username="marcopolo" size={16} />}
          username="missingno"
          fullName="MissingNo"
          key="missingno"
          selected={false}
          onClick={action('onClick')}
          onHover={action('onHover')}
        />
      </Box>
    ))
    .add('Mention Hud', () => {
      const Hud = UpDownFilterHoc(({upCounter, downCounter, filter}) => (
        <Box style={{height: 100, width: 240, ...globalStyles.flexBoxColumn}}>
          <MentionHud
            userIds={['marcopolo', 'trex']}
            onPickUser={action('onPickUser')}
            onSelectUser={action('onSelectUser')}
            selectUpCounter={upCounter}
            selectDownCounter={downCounter}
            filter={filter}
            style={{flex: 1}}
            store={dummyStore}
          />
        </Box>
      ))
      return <Hud />
    })
}

export default load
