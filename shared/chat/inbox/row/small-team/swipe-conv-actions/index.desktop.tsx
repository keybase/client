import * as RowSizes from '@/chat/inbox/row/sizes'
import * as Kb from '@/common-adapters'
import type {Props} from '@/chat/inbox/row/small-team/swipe-conv-actions/index.shared'
const SwipeConvActions = (props: Props) => {
  return <div style={styles.row}>{props.children}</div>
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  row: {
    flexShrink: 0,
    height: RowSizes.smallRowHeight,
    width: '100%',
  },
}))
export default SwipeConvActions
