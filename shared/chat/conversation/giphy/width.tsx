const minWidth = 100
const maxWidth = 200

export const scaledWidth = (width: number) => {
  return width * 0.5
}

// getMargins implements a simple algorithm to resize GIF previews given a dynamic display size, and
// dynamic sized width GIFs. The basic idea is to try to form rows by either compressing down GIFs to fit,
// or expanding to fit, and see which method works better.
export const getMargins = (totalWidth: number, widths: Array<number>) => {
  const images: Array<Image> = []
  widths.forEach(w => {
    images.push(new Image(scaledWidth(w), 0))
  })
  // set to the desired size, some GIFs are very wide and take up too much space initially. We will allow
  // the expansion phase to go over this clamp however.
  clampAtMaxWidths(images)
  let res: Array<number> = []
  let longRow: Array<Image> = []
  for (let index = 0; index < images.length; index++) {
    const im = images[index]
    longRow.push(im)
    if (groupWidth(longRow) >= totalWidth) {
      // we have a row now that can be compressed, pick between it and the row minus the last image,
      // which we will attempt to expand.
      const shortRow = longRow.slice(0, -1)
      const pickRes = pickRow(totalWidth, index, longRow, shortRow)
      longRow = []
      index = pickRes.index // pickRow will tell us which image to being scanning on
      pickRes.row.forEach(im => {
        res.push(im.margin)
      })
    }
  }
  if (longRow.length > 0) {
    // expand anything that falls into the last row
    expandRow(totalWidth, longRow).forEach(im => {
      res.push(im.margin)
    })
  }
  return res
}

// Image represents a GIF that has some margin (compression) applied to it. An Image with margin === 0 is
// fully expanded.
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
      // max compressed, don't do anything
      return
    }
    let compressed = desired
    if (this.width() - compressed < minWidth) {
      // don't let this compress less than minWidth, just do as much as we can
      compressed = this.width() - minWidth
    }
    this.margin += compressed
  }

  expand = desired => {
    if (this.margin === 0) {
      // max expanded, don't do anything
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

// compressRow attempts to compress a candidate row down to a given width
const compressRow = (totalWidth, row) => {
  const compressed: Array<Image> = []
  row.forEach(i => {
    compressed.push(new Image(i.origWidth, i.margin))
  })
  for (let pass = 0; pass < maxCompressPasses; pass++) {
    const totalCompression = groupWidth(compressed) - totalWidth
    // figure out how much we will compress this pass
    let imageComp = Math.ceil(totalCompression / numCompressables(compressed))
    for (let i = 0; i < compressed.length; i++) {
      compressed[i].compress(imageComp)
      const newWidth = groupWidth(compressed)
      if (newWidth <= totalWidth) {
        // done here, compression has succeeded
        return compressed
      }
      if (newWidth - imageComp < totalWidth) {
        // if we are going to compress than less than width with the current imageComp, set it to
        // the remaining about of space.
        imageComp = newWidth - totalWidth
      }
    }
  }
  throw new Error('unable to compress')
}

// expandRow attempt to expand a candidate row into a given width
const expandRow = (totalWidth, row) => {
  const expanded: Array<Image> = []
  row.forEach(i => {
    expanded.push(new Image(i.origWidth, i.margin))
  })
  for (let pass = 0; pass < maxExpandPasses; pass++) {
    const totalExpansion = totalWidth - groupWidth(expanded)
    const expandables = numExpandables(expanded)
    if (expandables === 0) {
      // if we can't expand anything, just return what we have
      return expanded
    }
    let imageExp = Math.floor(totalExpansion / expandables)
    if (imageExp === 0) {
      // if this rounds down into 0, then just set to the remaining distance to be expanded into
      imageExp = totalWidth - groupWidth(expanded)
    }
    for (let i = 0; i < expanded.length; i++) {
      expanded[i].expand(imageExp)
      if (groupWidth(expanded) >= totalWidth) {
        return expanded
      }
    }
  }
  // always return something in the expand case
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
  // Pick which row is the closest, biasing for compression if both succeed.
  const compWidth = groupWidth(compressed)
  const expandWidth = groupWidth(expanded)
  const compDistance = totalWidth - compWidth
  let expandDistance = totalWidth - expandWidth
  if (expandDistance < 0) {
    expandDistance = 0
  }
  if (compDistance <= expandDistance) {
    return {
      index: longIndex,
      row: compressed,
    }
  }
  return {
    index: longIndex - 1,
    row: expanded,
  }
}
