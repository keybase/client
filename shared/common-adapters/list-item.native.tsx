import type {Props} from './list-item'
import {Box2} from './box'
import ClickableBox from './clickable-box'

const ListItem = (p: Props) => {
  const height = {Large: 64, Small: 48}[p.type] // minimum height
  const listItem = (
    <Box2 direction="horizontal" fullWidth={true} style={p.containerStyle}>
      <Box2 direction="vertical" style={{height, width: 0}} />
      <Box2 direction="vertical">
        <Box2
          direction="vertical"
          centerChildren={true}
          style={{
            ...iconContainerThemed[p.type],
            height,
          }}
        >
          {p.icon}
        </Box2>
      </Box2>
      <Box2
        direction="vertical"
        style={{
          ...bodyContainerStyle(p.swipeToAction),
          ...p.bodyContainerStyle,
        }}
      >
        {p.body}
      </Box2>
      {!p.swipeToAction && (
        <Box2
          direction="vertical"
          style={{
            ...actionStyle(!!p.extraRightMarginAction),
            justifyContent: 'center',
          }}
        >
          {p.action}
        </Box2>
      )}
    </Box2>
  )
  return <ClickableBox onClick={p.onClick}>{listItem}</ClickableBox>
}

const iconContainerThemed = {
  Large: {
    width: 64,
  },
  Small: {
    width: 48,
  },
}

function actionStyle(extraMargin: boolean) {
  return extraMargin ? {marginRight: 32} : {marginRight: 16}
}

function bodyContainerStyle(swipeToAction?: boolean) {
  return {
    flex: 2,
    justifyContent: 'center',
    marginBottom: 8,
    marginLeft: 8,
    marginRight: swipeToAction ? 0 : 16,
    marginTop: 8,
  } as const
}

export default ListItem
