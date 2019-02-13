// @flow

export const scaledWidth = (width: number) => {
  return width * 0.5
}

export const getMargin = (width: number, maxWidth: number) => {
  const m = -((scaledWidth(width) - maxWidth) / 2)
  return m > 0 ? 0 : m
}
