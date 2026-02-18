import {Box2} from './box'
import {desktopStyles} from '@/styles'
import type {Props} from './list-item'

const ListItem = (p: Props) => {
  const clickable = !!p.onClick
  const minHeight = {Large: 56, Small: 40}[p.type]
  return (
    <Box2
      direction="horizontal"
      fullWidth={true}
      style={{
        ...containerStyle(clickable),
        minHeight,
        ...p.containerStyle,
      }}
    >
      <Box2 direction="vertical">
        <Box2
          direction="vertical"
          centerChildren={true}
          style={{
            height: minHeight,
            width: minHeight,
          }}
        >
          {p.icon}
        </Box2>
      </Box2>
      <Box2 direction="vertical" style={bodyContainerStyle(p.type)}>
        {p.body}
      </Box2>
      <Box2
        direction="vertical"
        style={{
          ...actionStyle(!!p.extraRightMarginAction),
          justifyContent: 'center',
        }}
      >
        {p.action}
      </Box2>
    </Box2>
  )
}

function containerStyle(clickable: boolean) {
  return clickable ? desktopStyles.clickable : {}
}

function actionStyle(extraMargin: boolean) {
  return extraMargin ? {marginRight: 32} : {marginRight: 16}
}

const bodyContainerStyle = (type: 'Large' | 'Small') =>
  ({
    flex: 2,
    justifyContent: 'center',
    marginBottom: type === 'Small' ? 4 : 8,
    marginLeft: 8,
    marginRight: 8,
    marginTop: type === 'Small' ? 4 : 8,
  }) as const

export default ListItem
