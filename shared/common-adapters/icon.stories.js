// @flow
/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
import Icon from './icon'
import React from 'react'
import {action} from '@storybook/addon-actions'
import {globalStyles, globalColors} from '../styles'
import {iconMeta} from './icon.constants'
import {storiesOf} from '@storybook/react'

import type {IconType} from './icon'

const commonProps = {
  hint: 'hint text',
  onClick: (event: SyntheticEvent) => action('onClick'),
  onMouseEnter: () => action('onMouseEnter'),
  onMouseLeave: () => action('onMouseLeave'),
  style: {
    borderColor: globalColors.black_05,
    borderStyle: 'solid',
    borderWidth: 1,
    margin: 5,
  },
}

const sizes = {}

// $FlowIssue
Object.keys(iconMeta).map((type: IconType) => {
  const meta = iconMeta[type]
  const twoRegMatch = type.match(/(\d+)-x-\d+$/)
  const oneRegMatch = type.match(/(\d+)$/)
  const size = meta.gridSize || (twoRegMatch && twoRegMatch[1]) || (oneRegMatch && oneRegMatch[1]) || '?'

  if (!sizes[size]) {
    sizes[size] = []
  }

  sizes[size].push(type)
})

storiesOf('Icon', module).add('Icon', () => (
  <div style={{...globalStyles.flexBoxRow, flex: 1, overflow: 'auto'}}>
    {Object.keys(sizes).map(size => (
      <div key={size} style={{...globalStyles.flexBoxColumn}}>
        <span>{size}</span>
        {sizes[size].map(type => <Icon key={type} type={type} {...commonProps} />)}
      </div>
    ))}
  </div>
))
