import * as React from 'react'
import * as Types from '../../constants/types/fs'
import PathItemInfo from './path-item-info-container'
import TlfInfo from './tlf-info-container'

type Props = {
  path: Types.Path
  mode: 'row' | 'default' | 'menu'
}

export default (props: Props) => {
  switch (Types.getPathLevel(props.path)) {
    case 0:
    case 1:
    case 2:
      return null
    case 3:
      // TlfInfo does not have a mode='menu'
      return (
        <TlfInfo
          path={props.path}
          mode={props.mode === 'row' ? ('row' as 'row') : ('default' as 'default')}
        />
      )
    default:
      return <PathItemInfo {...props} />
  }
}
