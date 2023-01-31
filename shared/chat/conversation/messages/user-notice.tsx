import * as React from 'react'
import * as Kb from '../../../common-adapters'

export type Props = {
  children?: React.ReactNode
  showAvatar?: boolean
}

const UserNotice = ({children}: Props) => (
  <Kb.Box2 direction="vertical" alignSelf="flex-start" fullWidth={true}>
    {children}
  </Kb.Box2>
)

export default UserNotice
