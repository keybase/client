export const friction = (overScrollFraction: number) => {
  'worklet'
  return 1 * Math.pow(1 - overScrollFraction, 2)
}
