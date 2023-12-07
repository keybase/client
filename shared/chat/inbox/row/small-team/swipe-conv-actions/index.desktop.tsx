import * as React from 'react'
import * as RowSizes from '../../sizes'
import * as Kb from '@/common-adapters'
import type {Props} from '.'

const SwipeConvActions = (props: Props) => {
  return (
    <div style={styles.row} onClick={props.onClick}>
      {props.children}
    </div>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  row: {
    flexShrink: 0,
    height: RowSizes.smallRowHeight,
    width: '100%',
  },
}))
export default SwipeConvActions
