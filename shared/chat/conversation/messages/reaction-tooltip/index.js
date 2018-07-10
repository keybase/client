// @flow
import * as React from 'react'
import {Box2, FloatingBox, Text} from '../../../../common-adapters'

type Props = {
  attachmentRef?: ?React.Component<any, any>,
  onHidden: () => void,
  onReact: string => void,
  reaction: string,
  users: Array<{fullName: string, username: string}>,
}

const ReactionTooltip = (props: Props) => (
  <FloatingBox attachTo={props.attachmentRef} onHidden={props.onHidden} position="top right">
    <Box2 direction="vertical">
      <Text type="Body">Hi</Text>
    </Box2>
  </FloatingBox>
)

export default ReactionTooltip
