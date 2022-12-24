import * as React from 'react'
import * as Styles from '../../../../../styles'
import * as RowSizes from '../../sizes'

const SwipeConvActions = (props: {children: React.ReactNode}) => {
  return <div style={styles.row}>{props.children}</div>
}

const styles = Styles.styleSheetCreate(() => ({
  row: {
    flexShrink: 0,
    height: RowSizes.smallRowHeight,
    width: '100%',
  },
}))
export default SwipeConvActions
