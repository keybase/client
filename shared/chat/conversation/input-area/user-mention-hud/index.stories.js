// @flow
import React from 'react'
import * as I from 'immutable'
import * as PropProviders from '../../../../stories/prop-providers'
import {MentionRowRenderer, MentionHud} from '.'
import {compose, withStateHandlers} from '../../../../util/container'
import {Box, Button, Input, ButtonBar} from '../../../../common-adapters'
import {storiesOf, action, createPropProvider} from '../../../../stories/storybook'
import {globalStyles} from '../../../../styles'

const provider = createPropProvider(PropProviders.Usernames(), PropProviders.Avatar())

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
  storiesOf('Chat/Heads up Display', module)
    .addDecorator(provider)
    .add('Mention Row', () => (
      <Box style={{width: 240}}>
        <MentionRowRenderer
          following={I.Set()}
          you="chris"
          username="trex"
          fullName="T. Bone Rexasaurus"
          key="trex"
          selected={false}
          onClick={action('onClick')}
          onHover={action('onHover')}
        />
        <MentionRowRenderer
          following={I.Set()}
          you="chris"
          username="marcopolo"
          fullName="Marco Munizaga"
          key="marcopolo"
          selected={true}
          onClick={action('onClick')}
          onHover={action('onHover')}
        />
        <MentionRowRenderer
          following={I.Set()}
          you="chris"
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
        <Box style={{...globalStyles.flexBoxColumn, height: 100, width: 240}}>
          <MentionHud
            users={[{username: 'marcopolo', fullName: 'Marco Munizaga'}, {username: 'trex', fullName: ''}]}
            onPickUser={action('onPickUser')}
            onSelectUser={action('onSelectUser')}
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
