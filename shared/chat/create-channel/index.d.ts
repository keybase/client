import type * as React from 'react'
import type * as T from '@/constants/types'

export type Props = {
  navToChatOnSuccess?: boolean
  teamID: T.Teams.TeamID
}

declare const CreateChannel: (p: Props) => React.ReactNode
export default CreateChannel
