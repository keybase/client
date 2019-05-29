import * as React from 'react'

export type Props = {
  errorText: string
  success: boolean
  name: string
  successTeamName: string | null
  onBack: () => void
  onNameChange: () => void
  onSubmit: () => void
}

export default class JoinTeamDialog extends React.Component<Props> {}
