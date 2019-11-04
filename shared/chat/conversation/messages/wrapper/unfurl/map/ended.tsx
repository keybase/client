import * as React from 'react'
import * as Kb from '../../../../../../common-adapters'
import {formatTimeForMessages} from '../../../../../../util/timestamp'

type Props = {
  endTime?: number
}

const UnfurlSharingEnded = (props: Props) => (
  <Kb.Box2 direction="vertical">
    <Kb.Text type="BodyBig">Location sharing ended</Kb.Text>
    {props.endTime && (
      <Kb.Text type="BodySmallItalic">Last updated {formatTimeForMessages(props.endTime)}</Kb.Text>
    )}
  </Kb.Box2>
)

export default UnfurlSharingEnded
