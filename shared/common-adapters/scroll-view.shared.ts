export type ScrollViewRef = {
  scrollTo: (arg0: {x: number; y: number; animated?: boolean}) => void
  scrollToEnd: (options: {animated?: boolean; duration?: number}) => void
}
