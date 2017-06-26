// @flow
/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
import React from 'react'
import Box from './box'
import {storiesOf} from '@storybook/react'
import {globalMargins, globalStyles, globalColors} from '../styles'

storiesOf('Box', module).add('Box', () => (
  <div style={{flex: 1, overflow: 'auto'}}>
    {Object.keys(globalMargins).map(size => (
      <div key={size} style={{...globalStyles.flexBoxRow, margin: 30, width: '100%'}}>
        <div style={{...globalStyles.flexBoxColumn, alignItems: 'flex-end', width: '50%'}}>
          <Box
            style={{
              borderColor: globalColors.grey,
              borderStyle: 'dashed',
              borderWidth: 2,
              height: globalMargins[size],
              marginRight: 24,
              width: globalMargins[size],
            }}
          />
        </div>
        <div style={{width: '50%'}}>
          <p>{size}</p>
          <p>{globalMargins[size]}px</p>
        </div>
      </div>
    ))}
  </div>
))
