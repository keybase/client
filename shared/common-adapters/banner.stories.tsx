import * as React from 'react'
import {Box2, Banner} from '.'
import * as Sb from '../stories/storybook'

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Banner', () => (
      <Box2 direction="vertical" fullWidth={true} gap="small">
        <Banner key="1" color="red" text="this is a red banner with no action" />
        <Banner key="2" color="blue" text="this is a blue banner with no action" />
        <Banner key="3" color="yellow" text="this is a yellow banner with no action" />
        <Banner key="4" color="green" text="this is a green banner with no action" />
        <Banner key="5" color="grey" text="this is a grey banner with no action" />
        <Banner
          key="6"
          color="red"
          text="this is a red banner with super long text blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah yes very long"
        />
        <Banner
          key="7"
          color="red"
          text="this is a red closable banner with super long text blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah yes very long"
          onClose={Sb.action('onClose')}
        />
        <Banner key="8" color="red" text="this is a closable red banner" onClose={Sb.action('onClose')} />
        <Banner
          key="9"
          color="red"
          text="this is a red banner with actions and is closable"
          onClose={Sb.action('onClose')}
          actions={[
            {onClick: Sb.action('onClick-action1'), title: 'action1'},
            {onClick: Sb.action('onClick-action2'), title: 'action2'},
          ]}
        />
        <Banner
          key="10"
          color="red"
          text="this is a red banner with actions and super long text blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah yes very long"
          actions={[
            {onClick: Sb.action('onClick-action1'), title: 'action1'},
            {onClick: Sb.action('onClick-action2'), title: 'action2'},
          ]}
        />
        <Banner
          key="10"
          color="red"
          text="this is a narrow red banner with actions and super long text blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah yes very long"
          actions={[
            {onClick: Sb.action('onClick-action1'), title: 'action1'},
            {onClick: Sb.action('onClick-action2'), title: 'action2'},
          ]}
          narrow={true}
        />
      </Box2>
    ))
}

export default load
