// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {globalStyles, styleSheetCreate} from '../../../../styles'
// import Message from '../../messages'

type Props = {
  loadMoreMessages: () => void,
  messageOrdinals: I.List<Types.Ordinal>,
}

class ThreadView extends React.PureComponent<Props> {
  render() {
    return <div style={styles.container} />
  }
}

const styles = styleSheetCreate({
  container: {
    ...globalStyles.flexBoxColumn,
    flex: 1,
    overflowX: 'hidden',
    overflowY: 'auto',
  },
})

export default ThreadView
