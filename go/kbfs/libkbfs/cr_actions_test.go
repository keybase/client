// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"reflect"
	"testing"

	"github.com/keybase/client/go/kbfs/data"
)

func testPPS(s string) data.PathPartString {
	return data.NewPathPartString(s, nil)
}

func TestCRActionsCollapseNoChange(t *testing.T) {
	al := crActionList{
		&copyUnmergedEntryAction{
			testPPS("old1"), testPPS("new1"), "", false, false,
			data.DirEntry{}, nil},
		&copyUnmergedEntryAction{
			testPPS("old2"), testPPS("new2"), "", false, false,
			data.DirEntry{}, nil},
		&renameUnmergedAction{
			testPPS("old3"), testPPS("new3"), "", 0, false, data.ZeroPtr,
			data.ZeroPtr},
		&renameMergedAction{testPPS("old4"), testPPS("new4"), ""},
		&copyUnmergedAttrAction{
			testPPS("old5"), testPPS("new5"), []attrChange{mtimeAttr}, false},
	}

	newList := al.collapse()
	if !reflect.DeepEqual(al, newList) {
		t.Errorf("Collapse returned different list: %v vs %v", al, newList)
	}
}

func TestCRActionsCollapseEntry(t *testing.T) {
	al := crActionList{
		&copyUnmergedAttrAction{
			testPPS("old"), testPPS("new"), []attrChange{mtimeAttr}, false},
		&copyUnmergedEntryAction{
			testPPS("old"), testPPS("new"), "", false, false,
			data.DirEntry{}, nil},
		&renameUnmergedAction{
			testPPS("old"), testPPS("new"), "", 0, false, data.ZeroPtr,
			data.ZeroPtr},
	}

	expected := crActionList{
		al[2],
	}

	newList := al.collapse()
	if !reflect.DeepEqual(expected, newList) {
		t.Errorf("Collapse returned unexpected list: %v vs %v",
			expected, newList)
	}

	// change the order
	al = crActionList{al[1], al[2], al[0]}

	newList = al.collapse()
	if !reflect.DeepEqual(expected, newList) {
		t.Errorf("Collapse returned unexpected list: %v vs %v",
			expected, newList)
	}

	// Omit the top action this time
	al = crActionList{al[0], al[2]}
	expected = crActionList{al[0]}

	newList = al.collapse()
	if !reflect.DeepEqual(expected, newList) {
		t.Errorf("Collapse returned unexpected list: %v vs %v",
			expected, newList)
	}
}
func TestCRActionsCollapseAttr(t *testing.T) {
	al := crActionList{
		&copyUnmergedAttrAction{
			testPPS("old"), testPPS("new"), []attrChange{mtimeAttr}, false},
		&copyUnmergedAttrAction{
			testPPS("old"), testPPS("new"), []attrChange{exAttr}, false},
		&copyUnmergedAttrAction{
			testPPS("old"), testPPS("new"), []attrChange{mtimeAttr}, false},
	}

	expected := crActionList{
		&copyUnmergedAttrAction{
			testPPS("old"), testPPS("new"), []attrChange{mtimeAttr, exAttr},
			false},
	}

	newList := al.collapse()
	if !reflect.DeepEqual(expected, newList) {
		t.Errorf("Collapse returned unexpected list: %v vs %v",
			expected, newList)
	}
}
