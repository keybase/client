// @flow
import Box from './box'
import Icon from './icon'
import React from 'react'
import Text from './text'
import {globalStyles, globalColors} from '../styles'
import {iconMeta} from './icon.constants'
import {storiesOf, action} from '../stories/storybook'
import {isMobile} from '../constants/platform'

import type {IconType} from './icon'

const commonProps = {
  hint: 'hint text',
  onClick: (event: SyntheticEvent) => action('onClick'),
  onMouseEnter: () => action('onMouseEnter'),
  onMouseLeave: () => action('onMouseLeave'),
  style: {
    borderColor: globalColors.black_05,
    borderWidth: 1,
    margin: 5,
    ...(isMobile
      ? {}
      : {
          borderStyle: 'solid',
        }),
  },
}

const load = () => {
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

  storiesOf('Icon', module).add('Icon', () =>
    Object.keys(sizes).map(size =>
      <Box key={size}>
        <Text type="Body">
          {size}
        </Text>
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
          }}
        >
          {sizes[size].map(type => <Icon key={type} type={type} {...commonProps} />)}
        </Box>
      </Box>
    )
  )
}

export default load
