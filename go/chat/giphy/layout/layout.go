package layout

const minWidth = 100
const maxWidth = 250

type image struct {
	origWidth int
	margin    int
}

func newImage(width int) *image {
	return &image{
		origWidth: width,
	}
}

func (i *image) width() int {
	return i.origWidth - i.margin
}

func (i *image) clamp(maxWidth int) {
	if i.origWidth > maxWidth {
		i.margin = maxWidth - i.origWidth
	}
}

func clampAtMaxWidths(images []*image) {
	for _, i := range images {
		i.clamp(maxWidth)
	}
}

func groupWidth(images []*image) (total int) {
	for _, i := range images {
		total += i.width()
	}
	return total
}

func layout(totalWidth int, widths []int) (finalRows [][]*image) {
	// form images
	var images []*image
	for _, w := range widths {
		images = append(images, newImage(w))
	}
	// clamp
	clampAtMaxWidths(images)

	// layout rows
	var shortRow []*image
	var longRow []*image
	curWidth := 0
	for index := 0; index < len(images); index++ {
		im := images[index]
		longRow = append(longRow, im)
		curWidth += im.width()
		if curWidth >= totalWidth {
			shortRow = longRow[:len(longRow)-1]
			row, nextIndex := pickRow(totalWidth, longRow, shortRow)
			longRow = nil
			index = nextIndex
			finalRows = append(finalRows, row)
		}
	}
	return finalRows
}
