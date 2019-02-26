package layout

import (
	"fmt"
	"testing"
)

func TestGiphyLayout(t *testing.T) {
	totalWidth := 1000
	widths := []int{356, 200, 497, 292, 100, 267, 200, 200, 356, 356, 356, 360, 384, 200, 205, 168, 267,
		268, 236, 222, 168, 358, 266, 200, 390}
	layout := layout(totalWidth, widths)
	for rowIndex, row := range layout {
		fmt.Printf("rowidx: %d total: %d (", rowIndex, groupWidth(row))
		for _, im := range row {
			fmt.Printf("[%d,%d] ", im.origWidth, im.margin)
		}
		fmt.Printf(")\n")
	}
}
