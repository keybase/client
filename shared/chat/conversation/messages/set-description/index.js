// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'

type Props = {
  message: Types.MessageSetDescription,
}

export default (props: Props) => {
  const desc = props.message.newDescription.stringValue()
  return desc ? (
    <Kb.Text type="BodySmall">
      set the channel description: <Kb.Text type="BodySmallSemiboldItalic">{desc}</Kb.Text>
    </Kb.Text>
  ) : (
    <Kb.Text type="BodySmall">cleared the channel description.</Kb.Text>
  )
}
