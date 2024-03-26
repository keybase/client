import * as React from 'react'
import type {Props} from './list-item'
import Box from './box'
import ClickableBox from './clickable-box'
import {globalStyles} from '@/styles'

const ListItem = (p: Props) => {
  const height = {Large: 64, Small: 48}[p.type] // minimum height
  const listItem = (
    <Box style={{...globalStyles.flexBoxRow, ...p.containerStyle}}>
      <Box style={{height, width: 0}} />
      <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'flex-start'}}>
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            ...iconContainerThemed[p.type],
            alignItems: 'center',
            height,
            justifyContent: 'center',
          }}
        >
          {p.icon}
        </Box>
      </Box>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          ...bodyContainerStyle(p.swipeToAction),
          ...p.bodyContainerStyle,
        }}
      >
        {p.body}
      </Box>
      {!p.swipeToAction && (
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            ...actionStyle(!!p.extraRightMarginAction),
            justifyContent: 'center',
          }}
        >
          {p.action}
        </Box>
      )}
    </Box>
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
