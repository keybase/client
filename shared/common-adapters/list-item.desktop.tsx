import * as React from 'react'
import Box from './box'
import {globalStyles, desktopStyles} from '@/styles'
import type {Props} from './list-item'

const ListItem = (p: Props) => {
  const clickable = !!p.onClick
  const minHeight = {Large: 56, Small: 40}[p.type]
  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        ...containerStyle(clickable),
        minHeight,
        ...p.containerStyle,
      }}
    >
      <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'flex-start'}}>
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            alignItems: 'center',
            height: minHeight,
            justifyContent: 'center',
            width: minHeight,
          }}
        >
          {p.icon}
        </Box>
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, ...bodyContainerStyle(p.type)}}>{p.body}</Box>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          ...actionStyle(!!p.extraRightMarginAction),
          justifyContent: 'center',
        }}
      >
        {p.action}
      </Box>
    </Box>
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
