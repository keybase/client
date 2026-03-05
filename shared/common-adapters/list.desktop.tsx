import type {CSSProperties} from 'react'
import * as Styles from '@/styles'
import {LegendList} from '@legendapp/list/react'
import type {Props} from './list'
import {useListProps} from './list-common'

function List<T>(p: Props<T>) {
  const {empty, ...listProps} = useListProps(p)
  const {style, desktopRef} = p
  if (empty) return null

  return (
    <LegendList
      ref={desktopRef as any}
      {...listProps}
      style={
        {
          height: '100%',
          overflowY: 'auto',
          scrollbarGutter: 'stable',
          width: '100%',
          ...Styles.castStyleDesktop(style),
        } as CSSProperties
      }
    />
  )
}

export default List
