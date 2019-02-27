// @flow

export const scaledWidth = (width: number) => {
  return width * 0.5
}

const minWidth = 100
const maxWidth = 200

class Image {
  origWidth = 0
  margin = 0

  constructor(origWidth, margin) {
    this.origWidth = origWidth
    this.margin = margin
  }

  width = () => {
    return this.origWidth - this.margin
  }

  clamp = () => {
    if (this.origWidth > maxWidth) {
      this.margin = this.origWidth - maxWidth
    }
  }

  compress = desired => {
    if (this.width() <= minWidth) {
      return
    }
    let compressed = desired
    if (this.width() - compressed < minWidth) {
      compressed = this.width() - minWidth
    }
    this.margin += compressed
  }

  expand = desired => {
    if (this.margin === 0) {
      return
    }
    const expand = desired
    if (this.width() + expand > this.origWidth) {
      this.margin = 0
    } else {
      this.margin -= expand
    }
  }

  isCompressable = () => {
    return this.width() > minWidth
  }

  isExpandable = () => {
    return this.margin > 0
  }
}

const clampAtMaxWidths = images => {
  images.forEach(i => {
    i.clamp()
  })
}

const groupWidth = images => {
  return images.reduce((total, i) => {
    return total + i.width()
  }, 0)
}

const numCompressables = images => {
  return images.reduce((total, i) => {
    return total + (i.isCompressable() ? 1 : 0)
  }, 0)
}

const numExpandables = images => {
  return images.reduce((total, i) => {
    return total + (i.isExpandable() ? 1 : 0)
  }, 0)
}

const maxCompressPasses = 15
const maxExpandPasses = 15

const compressRow = (totalWidth, row) => {
  const compressed = []
  row.forEach(i => {
    compressed.push(new Image(i.origWidth, i.margin))
  })
  for (let pass = 0; pass < maxCompressPasses; pass++) {
    const totalCompression = groupWidth(compressed) - totalWidth
    let imageComp = Math.ceil(totalCompression / numCompressables(compressed))
    console.log(`compressRow: totalWidth: ${totalWidth} width: ${groupWidth(compressed)} comp: ${imageComp}`)
    for (let i = 0; i < compressed.length; i++) {
      if (groupWidth(compressed) - imageComp < totalWidth) {
        imageComp = groupWidth(compressed) - totalWidth
      }
      compressed[i].compress(imageComp)
      if (groupWidth(compressed) <= totalWidth) {
        return compressed
      }
    }
  }
  throw new Error('unable to compress')
}

const expandRow = (totalWidth, row) => {
  const expanded = []
  row.forEach(i => {
    expanded.push(new Image(i.origWidth, i.margin))
  })
  for (let pass = 0; pass < maxExpandPasses; pass++) {
    const totalExpansion = totalWidth - groupWidth(expanded)
    const expandables = numExpandables(expanded)
    if (expandables === 0) {
      return expanded
    }
    let imageExp = Math.floor(totalExpansion / expandables)
    if (imageExp === 0) {
      imageExp = totalWidth - groupWidth(expanded)
    }
    console.log(`expandRow: width: ${groupWidth(expanded)} exp: ${imageExp}`)
    for (let i = 0; i < expanded.length; i++) {
      expanded[i].expand(imageExp)
      if (groupWidth(expanded) >= totalWidth) {
        return expanded
      }
    }
  }
  return expanded
}

const pickRow = (totalWidth, longIndex, longRow, shortRow) => {
  let compressed
  const expanded = expandRow(totalWidth, shortRow)
  try {
    compressed = compressRow(totalWidth, longRow)
  } catch (e) {
    return {
      index: longIndex - 1,
      row: expanded,
    }
  }
  const compWidth = groupWidth(compressed)
  const expandWidth = groupWidth(expanded)
  const compDistance = totalWidth - compWidth
  let expandDistance = totalWidth - expandWidth
  if (expandDistance < 0) {
    expandDistance = 0
  }
  if (compDistance < expandDistance) {
    return {
      index: longIndex,
      row: compressed,
    }
  } else if (compDistance > expandDistance) {
    return {
      index: longIndex - 1,
      row: expanded,
    }
  } else {
    return {
      index: longIndex,
      row: compressed,
    }
  }
}

export const getMargins = (totalWidth: number, widths: Array<number>) => {
  const images = []
  widths.forEach(w => {
    images.push(new Image(scaledWidth(w), 0))
  })
  clampAtMaxWidths(images)
  let res = []
  let longRow = []
  for (let index = 0; index < images.length; index++) {
    const im = images[index]
    longRow.push(im)
    if (groupWidth(longRow) >= totalWidth) {
      const shortRow = longRow.slice(0, -1)
      const pickRes = pickRow(totalWidth, index, longRow, shortRow)
      longRow = []
      index = pickRes.index
      pickRes.row.forEach(im => {
        res.push(im.margin)
      })
    }
  }
  if (longRow.length > 0) {
    expandRow(totalWidth, longRow).forEach(im => {
      res.push(im.margin)
    })
  }
  return res
}
