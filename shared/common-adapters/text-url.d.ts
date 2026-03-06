export declare function useClickURL(url: string | undefined): {
  readonly onClick?: (e: React.BaseSyntheticEvent) => void
  readonly onContextMenu?: (e: React.BaseSyntheticEvent) => void
  readonly onLongPress?: () => void
}
