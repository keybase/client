package layout

import (
	"errors"
	"fmt"
	"math"
)

const minWidth = 200
const maxWidth = 300

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
		i.margin = i.origWidth - maxWidth
	}
}

func (i *image) dup() *image {
	return &image{
		origWidth: i.origWidth,
		margin:    i.margin,
	}
}

func (i *image) compress(desired int) {
	if i.width() <= minWidth {
		return
	}
	compressed := desired
	if i.width()-compressed < minWidth {
		compressed = i.width() - minWidth
	}
	i.margin += compressed
}

func (i *image) expand(desired int) {
	if i.margin == 0 {
		return
	}
	expand := desired
	if i.width()+expand > i.origWidth {
		i.margin = 0
	} else {
		i.margin -= expand
	}
}

func (i *image) isCompressable() bool {
	return i.width() > minWidth
}

func (i *image) isExpandable() bool {
	return i.margin > 0
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

func numCompressables(images []*image) (total int) {
	for _, i := range images {
		if i.isCompressable() {
			total++
		}
	}
	return total
}

func numExpandables(images []*image) (total int) {
	for _, i := range images {
		if i.isExpandable() {
			total++
		}
	}
	return total
}

func compressRow(totalWidth int, row []*image) (compressed []*image, err error) {
	maxCompressPasses := 15
	for _, i := range row {
		compressed = append(compressed, i.dup())
	}
	fmt.Printf("compressRow: totalWidth: %d width: %d\n", totalWidth, groupWidth(row))
	for pass := 0; pass < maxCompressPasses; pass++ {
		totalCompression := groupWidth(compressed) - totalWidth
		imageComp := int(math.Ceil(float64(totalCompression) / float64(numCompressables(compressed))))
		fmt.Printf("compressRow: pass: %d row: total: %d comp: %d\n", pass, totalCompression, imageComp)
		for _, im := range compressed {
			im.compress(imageComp)
		}
		fmt.Printf("compressRow: pass: %d (post) row: width: %d\n", pass, groupWidth(compressed))
		if groupWidth(compressed) <= totalWidth {
			return compressed, nil
		}
	}
	return compressed, errors.New("failed to compress")
}

func expandRow(totalWidth int, row []*image) (expanded []*image) {
	maxExpandPasses := 15
	for _, i := range row {
		expanded = append(expanded, i.dup())
	}
	fmt.Printf("expandRow: totalWidth: %d width: %d\n", totalWidth, groupWidth(row))
	for pass := 0; pass < maxExpandPasses; pass++ {
		totalExpansion := totalWidth - groupWidth(expanded)
		expandables := numExpandables(expanded)
		if expandables == 0 {
			return expanded
		}
		imageExp := int(math.Ceil(float64(totalExpansion) / float64(numExpandables(expanded))))
		fmt.Printf("expandRow: pass %d total: %d exp: %d\n", pass, totalExpansion, imageExp)
		for _, im := range expanded {
			im.expand(imageExp)
		}
		fmt.Printf("expandRow: pass %d width: %d\n", pass, groupWidth(expanded))
		if groupWidth(expanded) >= totalWidth {
			return expanded
		}
	}
	return expanded
}

func pickRow(totalWidth, longIndex int, longRow, shortRow []*image) (row []*image, index int) {
	fmt.Printf("pickRow: index: %d\n", longIndex)
	expanded := expandRow(totalWidth, shortRow)
	compressed, compressErr := compressRow(totalWidth, longRow)
	if compressErr != nil {
		return expanded, longIndex
	}
	compWidth := groupWidth(compressed)
	expandWidth := groupWidth(expanded)
	compDistance := totalWidth - compWidth
	expandDistance := totalWidth - expandWidth
	if expandDistance < 0 {
		expandDistance = 0
	}
	fmt.Printf("pickRow: index: %d compWidth: %d expandWidth: %d compDistance: %d expandDistance: %d\n",
		longIndex, compWidth, expandWidth, compDistance, expandDistance)
	if compDistance < expandDistance {
		return compressed, longIndex
	} else if compDistance > expandDistance {
		return expanded, longIndex - 1
	} else {
		return compressed, longIndex
	}
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
	for index := 0; index < len(images); index++ {
		im := images[index]
		longRow = append(longRow, im)
		if groupWidth(longRow) >= totalWidth {
			shortRow = longRow[:len(longRow)-1]
			row, nextIndex := pickRow(totalWidth, index, longRow, shortRow)
			longRow = nil
			index = nextIndex
			finalRows = append(finalRows, row)
		}
	}
	return finalRows
}
