// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package flexibletable

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMultiCellMinWidth(t *testing.T) {
	cell := MultiCell{
		Sep: ",",
		Items: []string{
			"andy",
			"bob",
			"chris",
			"david",
			"evan",
			"fred",
			"gabriel",
			"hooray",
			"ikea",
		},
	}
	if cell.minWidth() != 5 {
		// "+10..."
		require.FailNow(t, fmt.Sprintf("wrong min width; expected 5, got %d\n", cell.minWidth()))
	}
	cell.Items = append(cell.Items, "jack")
	if cell.minWidth() != 6 {
		// "+10..."
		require.FailNow(t, fmt.Sprintf("wrong min width; expected 6, got %d\n", cell.minWidth()))
	}
}

func TestMultiCellString(t *testing.T) {
	cell := MultiCell{
		Sep: ",",
		Items: []string{
			"andy",
			"bob",
			"chris",
		},
	}

	str := cell.render(6)
	require.Equal(t, "+3...", str, `wrong string; expected "+3...", got "%s"`, str)

	str = cell.render(10)
	require.Equal(t, "andy,+2...", str, `wrong string; expected "andy,+2...", got "%s"`, str)

	str = cell.render(13)
	require.Equal(t, "andy,+2...", str, `wrong string; expected "andy,+2...", got "%s"`, str)

	str = cell.render(14)
	require.Equal(t, "andy,bob,chris", str, `wrong string; expected "andy,bob,chris", got "%s"`, str)
}

func TestSingleCellWithFrame(t *testing.T) {
	cell := Cell{
		Content:   SingleCell{Item: "123456789"},
		Frame:     [2]string{"[", "]"},
		Alignment: Left,
	}

	str, err := cell.render(11)
	require.NoError(t, err)
	require.Equal(t, "[123456789]", str, "expected [123456789], got %s", str)

	str, err = cell.render(10)
	require.NoError(t, err)
	require.Equal(t, "[12345...]", str, "expected [12345...], got %s", str)
}
