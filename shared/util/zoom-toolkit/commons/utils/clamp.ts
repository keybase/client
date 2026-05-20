export const clamp = (value: number, min: number, max: number): number => {
  'worklet'
  return Math.max(min, Math.min(value, max))
}
