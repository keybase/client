export type MeasureDesktop = {
  x: number
  y: number
  width: number
  height: number
  left: number
  top: number
  right: number
  bottom: number
}
export type MeasureNative = {
  x: number
  y: number
  width: number
  height: number
  pageX: number
  pageY: number
}
export type MeasureRef = {
  // desktop
  measure?: () => MeasureDesktop | undefined
  divRef: React.RefObject<HTMLDivElement>
  // mobile
  measureAsync?: () => Promise<MeasureNative | undefined>
}
