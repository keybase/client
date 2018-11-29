// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Sb from '../../../../stories/storybook'
import {MentionRowRenderer, MentionHud} from '.'
import {compose, withStateHandlers} from '../../../../util/container'
import {Box, Button, Input, ButtonBar} from '../../../../common-adapters'
import {globalStyles} from '../../../../styles'

const UpDownFilterHoc = compose(
  withStateHandlers(
    {
      downCounter: 0,
      filter: '',
      upCounter: 0,
    },
    {
      increaseDownCounter: ({downCounter}) => () => ({downCounter: downCounter + 1}),
      setFilter: () => filter => ({filter}),
      increaseUpCounter: ({upCounter}) => () => ({upCounter: upCounter + 1}),
    }
  ),
  Component => props => (
    <Box style={globalStyles.flexBoxColumn}>
      <Component upCounter={props.upCounter} downCounter={props.downCounter} filter={props.filter} />
      <ButtonBar>
        <Button label="Up" type="Primary" onClick={props.increaseUpCounter} />
        <Button label="Down" type="Primary" onClick={props.increaseDownCounter} />
      </ButtonBar>
      <Input onChangeText={props.setFilter} hintText="Filter" />
    </Box>
  )
)

const load = () => {
  Sb.storiesOf('Chat/Heads up Display', module)
    .add('Mention Row', () => (
      <Box style={{width: 240}}>
        <MentionRowRenderer
          following={I.Set()}
          you="chris"
          username="trex"
          fullName="T. Bone Rexasaurus"
          key="trex"
          selected={false}
          onClick={Sb.action('onClick')}
          onHover={Sb.action('onHover')}
        />
        <MentionRowRenderer
          following={I.Set()}
          you="chris"
          username="marcopolo"
          fullName="Marco Munizaga"
          key="marcopolo"
          selected={true}
          onClick={Sb.action('onClick')}
          onHover={Sb.action('onHover')}
        />
        <MentionRowRenderer
          following={I.Set()}
          you="chris"
          username="missingno"
          fullName="MissingNo"
          key="missingno"
          selected={false}
          onClick={Sb.action('onClick')}
          onHover={Sb.action('onHover')}
        />
      </Box>
    ))
    .add('Mention Hud', () => {
      const Hud = UpDownFilterHoc(({upCounter, downCounter, filter}) => (
        <Box style={{...globalStyles.flexBoxColumn, height: 100, width: 240}}>
          <MentionHud
            _loadParticipants={() => {}}
            _generalChannelConversationIDKey="adfasdfsad"
            conversationIDKey="adfasdfsad"
            teamType="adhoc"
            loading={false}
            selectedIndex={0}
            setSelectedIndex={Sb.action('setSelectedIndex')}
            users={[{username: 'marcopolo', fullName: 'Marco Munizaga'}, {username: 'trex', fullName: ''}]}
            onPickUser={Sb.action('onPickUser')}
            onSelectUser={Sb.action('onSelectUser')}
            selectUpCounter={upCounter}
            selectDownCounter={downCounter}
            setMentionHudIsShowing={Sb.action('setMentionHudIsShowing')}
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
