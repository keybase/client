import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {globalMargins} from '../../../styles'
import {formatTimeForMessages} from '../../../util/timestamp'

type Props = {
  timestamp: number
}

class SystemMessageTimestamp extends React.PureComponent<Props> {
  render() {
    return (
      <Kb.Text center={true} type="BodyTiny" style={{marginTop: globalMargins.xtiny}}>
        {formatTimeForMessages(this.props.timestamp)}
      </Kb.Text>
    )
  }
}

export default SystemMessageTimestamp
