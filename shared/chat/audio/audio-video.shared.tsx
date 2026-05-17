export type Props = {
  url: string
  paused: boolean
  onPositionUpdated: (ratio: number) => void
  onEnded: () => void
}
