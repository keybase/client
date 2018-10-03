// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import Box from './box'
import Icon, {type IconType} from './icon'
import Text from './text'
import {globalStyles, globalColors, isMobile} from '../styles'
import {iconMeta} from './icon.constants'

const commonProps = {
  hint: 'hint text',
  onClick: Sb.action('onClick'),
  onMouseEnter: Sb.action('onMouseEnter'),
  onMouseLeave: Sb.action('onMouseLeave'),
  style: {
    borderColor: globalColors.black_10,
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

  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Icon', () => (
      <Box>
        <Text type="Body">Red on hover</Text>
        <Icon
          key="hoverColor"
          type="iconfont-add"
          {...commonProps}
          onClick={() => commonProps.onClick('iconfont-add')}
          hoverColor={globalColors.red}
        />
        <Text type="Body">Red due to inherit </Text>
        <Box style={isMobile ? {} : {color: 'red'}}>
          <Icon
            key="inherit"
            type="iconfont-add"
            {...commonProps}
            onClick={() => commonProps.onClick('iconfont-add')}
            inheritColor={true}
          />
        </Box>
        {Object.keys(sizes).map(size => (
          <Box key={size}>
            <Text type="Body">{size}</Text>
            <Box
              style={{
                ...globalStyles.flexBoxRow,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                justifyContent: 'flex-start',
              }}
            >
              {sizes[size].map(type => (
                <Icon key={type} type={type} {...commonProps} onClick={() => commonProps.onClick(type)} />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    ))
}

export default load
