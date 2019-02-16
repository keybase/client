// @flow

export const scaledWidth = (width: number) => {
  return width * 0.5
}

export const getMargin = (width: number, maxWidth: number) => {
  const m = -((scaledWidth(width) - maxWidth) / 2)
  return m > 0 ? 0 : m
}

const compressRow = (row, size, maxWidth) => {
  const margins = []
  const compression = -(maxWidth - size) / row.length
  for (let i = 0; i < row.length; i++) {
    const preview = row[i]
    const width = scaledWidth(preview.previewWidth)
    const compressedWidth = Math.max(width - compression, 100)
    const margin = -compressedWidth / 2
    margins.push(margin)
  }
  return margins
}

const expandRow = (row, maxWidth) => {}

export const getMargins = (previews: Array<RPCChatTypes.GiphySearchResult>, maxWidth: number) => {
  let longRowSize = 0
  let shortRowSize = 0
  let shortRow = []
  let longRow = []
  for (let i = 0; i < previews.length; i++) {
    const preview = previews[i]
    const width = scaledWidth(preview.previewWidth)
    longRowSize += width
    longRow.push(preview)
    if (longRowSize > maxWidth) {
      return compressRow(longRow, longRowSize, maxWidth)
    } else {
      shortRow.push(preview)
      shortRowSize += width
    }
  }
}
