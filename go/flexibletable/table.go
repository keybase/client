// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package flexibletable

import (
	"errors"
	"fmt"
	"io"
	"strings"
)

// ColumnConstraint specifies how a column should behave while being rendered.
// Use positive to specify a maximum width for the column, or one of const
// values for expandable width.
type ColumnConstraint int

const (

	// Expandable is a special ColumnConstraint where the column and may expand
	// automatically if other columns end up taking less actual width.
	Expandable ColumnConstraint = 0

	// ExpandableWrappable is a special ColumnConstraint where the column is
	// expandable. In addition, it  can wrap into multiple lines if needed.
	ExpandableWrappable ColumnConstraint = -1
)

// Row defines a row
type Row []Cell

// Table defines a table and is used to do the rendering
type Table struct {
	rows     []Row
	nInserts int
}

// Insert inserts a row into the table
func (t *Table) Insert(row Row) error {
	if len(t.rows) > 0 && len(t.rows[0]) != len(row) {
		return InconsistentRowsError{existingRows: len(t.rows), newRow: len(row)}
	}
	t.rows = append(t.rows, row)
	t.nInserts++
	return nil
}

func (t *Table) NumInserts() int {
	return t.nInserts
}

func (t *Table) breakOnLineBreaks() error {

	// so that there's no need to resize if there's no line break
	broken := make([]Row, 0, len(t.rows))

	for _, row := range t.rows {

		notEmpty := true
		for notEmpty {
			newRow := make(Row, 0, len(row))
			notEmpty = false

			for iCell := range row {
				switch content := row[iCell].Content.(type) {
				case emptyCell:
					newRow = append(newRow, Cell{
						Alignment: row[iCell].Alignment,
						Frame:     [2]string{"", ""},
						Content:   row[iCell].Content,
					})
				case MultiCell:
					notEmpty = true
					for iItem := range content.Items {
						// we are replacing line breaks with spaces for MultiCell for now
						content.Items[iItem] = strings.Replace(content.Items[iItem], "\n", " ", -1)
					}
					newRow = append(newRow, Cell{
						Alignment: row[iCell].Alignment,
						Frame:     row[iCell].Frame,
						Content:   content,
					})
					row[iCell].Content = emptyCell{}
				case SingleCell:
					notEmpty = true
					lb := strings.Index(content.Item, "\n")
					current := ""
					if lb >= 0 {
						current = content.Item[:lb]
						row[iCell].Content = SingleCell{Item: content.Item[lb+1:]}
					} else {
						current = content.Item
						row[iCell].Content = emptyCell{}
					}
					newRow = append(newRow, Cell{
						Alignment: row[iCell].Alignment,
						Frame:     row[iCell].Frame,
						Content:   SingleCell{Item: current},
					})
				default:
					// unexported error because this shouldn't happen unless we make a
					// mistake in code
					return errors.New("unexpected cell content")
				}
			}

			if notEmpty {
				broken = append(broken, newRow)
			}
		}

	}

	t.rows = broken
	return nil
}

func (t Table) renderFirstPass(cellSep string, maxWidth int, constraints []ColumnConstraint) (widths []int, err error) {
	numOfNoConstraints := 0
	for _, c := range constraints {
		if c <= 0 {
			numOfNoConstraints++
		}
	}

	// first pass; determine smallest width for each column under constraints
	widths = make([]int, len(t.rows[0]))
	for _, row := range t.rows {
		for i, c := range row {
			if constraints[i] > 0 {
				str, err := c.render(int(constraints[i]))
				if err != nil {
					return nil, err
				}
				if widths[i] < len(str) {
					widths[i] = len(str)
				}
			}
		}
	}

	// calculate width for un-constrained columns
	rest := maxWidth - len(cellSep)*(len(widths)-1) // take out cellSeps
	for _, w := range widths {
		rest -= w
	}
	each := rest / numOfNoConstraints
	last := -1
	for i := range widths {
		if constraints[i] <= 0 {
			widths[i] = each
			last = i
		}
	}
	if last != -1 {
		widths[last] = rest - each*(numOfNoConstraints-1)
	}

	return widths, nil
}

func (t Table) renderSecondPass(constraints []ColumnConstraint, widths []int) (rows [][]string, err error) {
	// actually rendering

	for _, row := range t.rows {
		var strs []string
		for ic, c := range row {
			if constraints[ic] >= 0 {
				str, err := c.renderWithPadding(widths[ic])
				if err != nil {
					return nil, err
				}
				strs = append(strs, str)
			} else { // need wrapping!
				strs = append(strs, c.full())
			}
		}

		wrapping := true
		for wrapping {
			var toAppend []string
			wrapping = false
			for i := range strs {
				if widths[i] < len(strs[i]) {
					toAppend = append(toAppend, strs[i][:widths[i]])
					strs[i] = strs[i][widths[i]:]
					wrapping = true
				} else {
					str, err := row[i].addPadding(strs[i], widths[i])
					if err != nil {
						return nil, err
					}
					toAppend = append(toAppend, str)
					strs[i] = strings.Repeat(" ", widths[i])
				}
			}
			rows = append(rows, toAppend)
		}
	}

	return rows, nil
}

// Render renders the table into writer. The constraints parameter specifies
// how each column should be constrained while being rendered. Positive values
// limit the maximum width.
func (t Table) Render(w io.Writer, cellSep string, maxWidth int, constraints []ColumnConstraint) error {
	if len(t.rows) == 0 {
		return NoRowsError{}
	}
	if len(constraints) != len(t.rows[0]) {
		return InconsistentRowsError{existingRows: len(t.rows[0]), newRow: len(constraints)}
	}

	err := t.breakOnLineBreaks()
	if err != nil {
		return err
	}

	widths, err := t.renderFirstPass(cellSep, maxWidth, constraints)
	if err != nil {
		return err
	}

	rows, err := t.renderSecondPass(constraints, widths)
	if err != nil {
		return err
	}

	// write out
	for _, row := range rows {
		fmt.Fprint(w, strings.Join(row, cellSep))
		fmt.Fprintln(w)
	}

	return nil
}
