/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import React from 'react'

import {storiesOf} from '@storybook/react'
import {action} from '@storybook/addon-actions'
import {linkTo} from '@storybook/addon-links'

import Text from '../common-adapters/text'

storiesOf('Text', module)
  .add('Header', () => <Text type="Header">Header</Text>)
  .add('Body', () => <Text type="Body">Body</Text>)

// import Button from './Button'
// import Welcome from './Welcome'

// storiesOf('Welcome', module).add('to Storybook', () => <Welcome showApp={linkTo('Button')} />)

// storiesOf('Button', module)
// .add('with text', () => <Button onClick={action('clicked')}>Hello Button</Button>)
// .add('with some emoji', () => <Button onClick={action('clicked')}>😀 😎 👍 💯</Button>)
