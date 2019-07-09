import * as React from 'react'
import {Box2, Banner} from '.'
import * as Sb from '../stories/storybook'

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Banner', () => (
      <Box2 direction="vertical" fullWidth={true} gap="small">
        <Banner key="1" color="red" content="this is a red banner with no action" />
        <Banner key="2" color="blue" content="this is a blue banner with no action" />
        <Banner key="3" color="yellow" content="this is a yellow banner with no action" />
        <Banner key="4" color="green" content="this is a green banner with no action" />
        <Banner key="5" color="grey" content="this is a grey banner with no action" />
        <Banner
          key="6"
          color="red"
          content="this is a red banner with super long text blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah yes very long"
        />
        <Banner
          key="7"
          color="red"
          content="this is a red closable banner with super long text blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah yes very long"
          onClose={Sb.action('onClose')}
        />
        <Banner key="8" color="red" content="this is a closable red banner" onClose={Sb.action('onClose')} />
        <Banner
          key="9"
          color="red"
          content={['A banner with array content', null, ' and ', false, 'that has null and false inside.']}
          onClose={Sb.action('onClose')}
        />
        <Banner
          key="10"
          color="red"
          content={[
            [
              'A banner with inline actions ',
              {onClick: Sb.action('action1'), text: 'action1'},
              ' and ',
              {onClick: Sb.action('action2'), text: 'action2'},
              ' and new line actions',
            ],
            [
              {onClick: Sb.action('action3'), text: 'action3'},
              ', ',
              {onClick: Sb.action('action4'), text: 'action4'},
            ],
          ]}
          onClose={Sb.action('onClose')}
        />
        <Banner
          key="11"
          color="red"
          content={[
            'Here is a super long banner message with ',
            {onClick: Sb.action('action1'), text: 'action1'},
            ' and ',
            {onClick: Sb.action('action2'), text: 'action2'},
            '. blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah',
          ]}
          onClose={Sb.action('onClose')}
        />
      </Box2>
    ))
}

export default load
