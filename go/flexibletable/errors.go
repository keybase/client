package flexibletable

import "fmt"

// InconsistentRowsError is an error that is returned when number of columns
// are inconsistent across rows.
type InconsistentRowsError struct {
	existingRows int
	newRow       int
}

// Error implements the error interface
func (e InconsistentRowsError) Error() string {
	return fmt.Sprintf("existing rows have %d cells but the new row has %d cells",
		e.existingRows, e.newRow)
}

// NoRowsError indicates no rows in the table.
type NoRowsError struct{}

// Error implements the error interface
func (e NoRowsError) Error() string {
	return "no rows"
}

// WidthTooSmallError indicates the width constraints is too small.
type WidthTooSmallError struct{}

// Error implements the error interface
func (e WidthTooSmallError) Error() string {
	return "width too small"
}

// BadOptionError indicates, well, bad options, are given.
type BadOptionError struct {
	optionName string
}

// Error implements the error interface
func (e BadOptionError) Error() string {
	return fmt.Sprintf("bad option %s", e.optionName)
}
