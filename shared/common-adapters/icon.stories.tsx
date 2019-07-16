import * as React from 'react'
import * as Sb from '../stories/storybook'
import Box from './box'
import Icon, {IconType} from './icon'
import Text from './text'
import * as Styles from '../styles'
import {iconMeta} from './icon.constants'

const commonProps = {
  hint: 'hint text',
  onClick: Sb.action('onClick'),
  onMouseEnter: Sb.action('onMouseEnter'),
  onMouseLeave: Sb.action('onMouseLeave'),
  style: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.black_10,
      borderWidth: 1,
      margin: 5,
    },
    isElectron: {borderStyle: 'solid', display: 'inline-block'},
  }),
}

const load = () => {
  const sizes = {}
  Object.keys(iconMeta).map((type: any) => {
    const meta = iconMeta[type as IconType]
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
        <Text type="Body">FontSize</Text>
        <Text type="Body">Big</Text>
        <Icon key="big" type="iconfont-add" {...commonProps} sizeType="Big" />
        <Text type="Body">Default</Text>
        <Icon key="default" type="iconfont-add" {...commonProps} sizeType="Default" />
        <Text type="Body">Small</Text>
        <Icon key="small" type="iconfont-add" {...commonProps} sizeType="Small" />
        <Text type="Body">Tiny</Text>
        <Icon key="tiny" type="iconfont-add" {...commonProps} sizeType="Tiny" />
        <Text type="Body">Red on hover</Text>
        <Icon
          key="hoverColor"
          type="iconfont-add"
          {...commonProps}
          onClick={() => commonProps.onClick('iconfont-add')}
          hoverColor={Styles.globalColors.red}
        />
        <Text type="Body">Red due to inherit </Text>
        <Box style={Styles.isMobile ? {} : {color: 'red'}}>
          <Icon
            key="inherit"
            type="iconfont-add"
            {...commonProps}
            onClick={() => commonProps.onClick('iconfont-add')}
            inheritColor={true}
          />
        </Box>
        {Object.keys(sizes).map(size => (
          <Box key={size} style={{flexShrink: 0}}>
            <Text type="Body">{size}</Text>
            <Box
              style={{
                ...Styles.globalStyles.flexBoxRow,
                alignItems: 'flex-start',
                flexShrink: 0,
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
