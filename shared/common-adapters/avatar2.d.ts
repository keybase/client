import type * as React from 'react'

type Props = {
  isTeam?: boolean
  size: 128 | 96 | 64 | 48 | 32 | 24 | 16
  teamname?: string
  username?: string
}

declare const Avatar2: (p: Props) => React.ReactNode
export default Avatar2
