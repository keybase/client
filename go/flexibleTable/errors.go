package flexibleTable

import "fmt"

type InconsistentRowsError struct {
	existingRows int
	newRow       int
}

func (e InconsistentRowsError) Error() string {
	return fmt.Sprintf("existing rows have %d cells but the new row has %d cells",
		e.existingRows, e.newRow)
}

type WidthTooSmallError struct{}

func (e WidthTooSmallError) Error() string {
	return "width too small"
}

type BadOptionError struct {
	optionName string
}

func (e BadOptionError) Error() string {
	return fmt.Sprintf("bad option %s", e.optionName)
}
