// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package flexibletable

import (
	"math"
	"strconv"
	"strings"
)

// Alignment defines how the content of a cell should align
type Alignment int

// Possible Alignment values
const (
	Left Alignment = iota // default
	Right
	Center
)

// Cell defines a cell (column) in a row
type Cell struct {
	// Content is the content of the cell. It can be either a SingleCell or a
	// MultiCell
	Content cellContent

	// Alignment specifies how the content of a cell should align
	Alignment Alignment

	// Frame defines a "frame" around the content. The array defines two strings,
	// which are added before and after the content, before any paddings are
	// inserted.
	Frame [2]string
}

func (c Cell) full() string {
	return c.Content.full()
}

func (c Cell) render(widthConstraint int) (string, error) {
	frameWidth := len(c.Frame[0]) + len(c.Frame[1])
	minWidth := c.Content.minWidth() + frameWidth
	if minWidth > widthConstraint {
		return "", WidthTooSmallError{}
	}
	return c.Frame[0] + c.Content.render(widthConstraint-frameWidth) + c.Frame[1], nil
}

func (c Cell) renderWithPadding(width int) (string, error) {
	str, err := c.render(width)
	if err != nil {
		return "", err
	}
	return c.addPadding(str, width)
}

func (c Cell) addPadding(str string, width int) (string, error) {
	padding := width - len(str)
	if padding == 0 {
		return str, nil
	}
	switch c.Alignment {
	case Left:
		return str + strings.Repeat(" ", padding), nil
	case Right:
		return strings.Repeat(" ", padding) + str, nil
	case Center:
		return strings.Repeat(" ", padding/2) + str + strings.Repeat(" ", padding-padding/2), nil
	default:
		return "", BadOptionError{optionName: "Alignment"}
	}
}

type cellContent interface {
	render(maxWidth int) string
	minWidth() int
	full() string
}

// emptyCell is an implementation of cellContent that is only used internally
// in flexibletable package during rendering.
type emptyCell struct{}

func (emptyCell) render(int) string { return "" }
func (emptyCell) minWidth() int     { return 0 }
func (emptyCell) full() string      { return "" }

// SingleCell defines cell content with a single string. If being truncated,
// the truncated part is replaced with "..."
type SingleCell struct {
	// Item is, well, the contnet.
	Item string
}

func (c SingleCell) full() string {
	return c.Item
}

func (c SingleCell) render(maxWidth int) string {
	if len(c.Item) <= maxWidth {
		return c.Item
	}
	return c.Item[:maxWidth-3] + "..."
}

func (c SingleCell) minWidth() int {
	if len(c.Item) < 3 {
		return len(c.Item)
	}
	return 3 // "..."
}

// MultiCell defines cell content with multiple strings. If being truncated, it
// looks like this: "item1,item2,+4..."
type MultiCell struct {
	// Sep is the separater between different items
	Sep string
	// Items are the content
	Items []string
}

func (c MultiCell) full() string {
	return strings.Join(c.Items, c.Sep)
}

func (c MultiCell) render(maxWidth int) (ret string) {
	retIfFull := "+" + strconv.Itoa(len(c.Items)) + "..."

	for i, item := range c.Items {
		var plus string
		if len(ret) > 0 {
			plus = c.Sep + item
		} else {
			plus = item
		}

		if len(plus)+len(ret) <= maxWidth {
			ret += plus
		} else {
			return retIfFull
		}

		newRetIfFull := ret + c.Sep + "+" + strconv.Itoa(len(c.Items)-i-1) + "..."
		if len(newRetIfFull) <= maxWidth {
			retIfFull = newRetIfFull
		}
	}

	return ret
}

func (c MultiCell) minWidth() int {
	simpleLen := len(strings.Join(c.Items, c.Sep))
	digestMin := int(math.Ceil(math.Log10(float64(len(c.Items)+1)))) + 4 // "+9..."
	if simpleLen < digestMin {
		return simpleLen
	}
	return digestMin
}
