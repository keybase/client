export type Props = {
  url: string
  onLoadingStateChange?: (isLoading: boolean) => void
  onUrlError?: (err: string) => void
}
