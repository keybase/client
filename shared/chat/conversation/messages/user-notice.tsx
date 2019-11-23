import * as React from 'react'
import * as Kb from '../../../common-adapters'

export type Props = {
  children?: React.ReactNode
}

const UserNotice = ({children}: Props) => (
  <Kb.Box2 key="content" direction="vertical" fullWidth={true}>
    {children}
  </Kb.Box2>
)
export default UserNotice
