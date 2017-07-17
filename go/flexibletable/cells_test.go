// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package flexibletable

import "testing"

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
		t.Fatalf("wrong min width; expected 5, got %d\n", cell.minWidth())
	}
	cell.Items = append(cell.Items, "jack")
	if cell.minWidth() != 6 {
		// "+10..."
		t.Fatalf("wrong min width; expected 6, got %d\n", cell.minWidth())
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
	if str != "+3..." {
		t.Fatalf(`wrong string; expected "+3...", got "%s"`, str)
	}

	str = cell.render(10)
	if str != "andy,+2..." {
		t.Fatalf(`wrong string; expected "andy,+2...", got "%s"`, str)
	}

	str = cell.render(13)
	if str != "andy,+2..." {
		t.Fatalf(`wrong string; expected "andy,+2...", got "%s"`, str)
	}

	str = cell.render(14)
	if str != "andy,bob,chris" {
		t.Fatalf(`wrong string; expected "andy,bob,chris", got "%s"`, str)
	}
}

func TestSingleCellWithFrame(t *testing.T) {
	cell := Cell{
		Content:   SingleCell{Item: "123456789"},
		Frame:     [2]string{"[", "]"},
		Alignment: Left,
	}

	str, err := cell.render(11)
	if err != nil {
		t.Fatal(err)
	}
	if str != "[123456789]" {
		t.Fatalf("expected [123456789], got %s", str)
	}

	str, err = cell.render(10)
	if err != nil {
		t.Fatal(err)
	}
	if str != "[12345...]" {
		t.Fatalf("expected [12345...], got %s", str)
	}
}
