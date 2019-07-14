export type Props = {
  channelname: string
  description: string
  errorText: string
  onBack?: () => void
  onClose?: () => void
  onSubmit: () => void
  onDescriptionChange: (description: string) => void
  onChannelnameChange: (channelname: string) => void
  teamname: string
}
