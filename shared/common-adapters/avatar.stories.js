// @flow
/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
import Avatar from './avatar'
import React from 'react'
import Text from './text'
import {action} from '@storybook/addon-actions'
import {globalStyles} from '../styles'
import {storiesOf} from '@storybook/react'

const sizes = [176, 112, 80, 64, 48, 40, 32, 24, 16, 12]

storiesOf('Avatar', module).add('Avatar', () => (
  <div style={{flex: 1, overflow: 'auto'}}>
    {sizes.map(size => {
      const commonProps = {
        following: false,
        followsYou: false,
        onClick: action('Avatar clicked'),
        size: size,
        style: avatarStyle,
        username: 'chris',
      }
      return (
        <div key={size}>
          <Text type="Body">{size}</Text>
          <div style={{...globalStyles.flexBoxRow}}>
            <Avatar {...commonProps} />
            <Avatar {...commonProps} borderColor="blue" />
            <Avatar {...commonProps} following={true} />
            <Avatar {...commonProps} followsYou={true} />
            <Avatar {...commonProps} following={true} followsYou={true} />
          </div>
        </div>
      )
    })}
  </div>
))

const avatarStyle = {
  marginLeft: 10,
}
