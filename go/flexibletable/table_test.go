// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package flexibletable

import (
	"bytes"
	"fmt"
	"strings"
	"testing"
)

func genTableForTest(t *testing.T) *Table {
	table := &Table{}
	if err := table.Insert(Row{
		Cell{Frame: [2]string{"[", "]"}, Alignment: Right, Content: SingleCell{"0"}},
		Cell{Alignment: Left, Content: MultiCell{Items: []string{"alice", "bob", "charlie", "david"}, Sep: ","}},
		Cell{Frame: [2]string{"[", "]"}, Alignment: Right, Content: SingleCell{"alice 4h"}},
		Cell{Alignment: Left, Content: SingleCell{"hello!"}},
	}); err != nil {
		t.Fatal(err)
	}
	if err := table.Insert(Row{
		Cell{Frame: [2]string{"[", "]"}, Alignment: Right, Content: SingleCell{"1"}},
		Cell{Alignment: Left, Content: MultiCell{Items: []string{"alice", "bob", "charlie", "david"}, Sep: ","}},
		Cell{Frame: [2]string{"[", "]"}, Alignment: Right, Content: SingleCell{"bob 2h"}},
		Cell{Alignment: Left, Content: SingleCell{"hello! wejoi fwoi jwe oiew oiwfowfw"}},
	}); err != nil {
		t.Fatal(err)
	}
	if err := table.Insert(Row{
		Cell{Frame: [2]string{"[", "]"}, Alignment: Right, Content: SingleCell{"10"}},
		Cell{Alignment: Left, Content: MultiCell{Items: []string{"alice", "bob", "charlie", "david"}, Sep: ","}},
		Cell{Frame: [2]string{"[", "]"}, Alignment: Right, Content: SingleCell{"charlie 4h"}},
		Cell{Alignment: Left, Content: SingleCell{"hello! this is super long hahahaha blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah"}},
	}); err != nil {
		t.Fatal(err)
	}
	if err := table.Insert(Row{
		Cell{Frame: [2]string{"[", "]"}, Alignment: Right, Content: SingleCell{"11"}},
		Cell{Alignment: Left, Content: MultiCell{Items: []string{"alice", "bob", "charlie", "david"}, Sep: ","}},
		Cell{Frame: [2]string{"[", "]"}, Alignment: Right, Content: SingleCell{"charliecharliecharlie 2h"}},
		Cell{Alignment: Left, Content: SingleCell{"hello! hello!"}},
	}); err != nil {
		t.Fatal(err)
	}
	return table
}

func readable(in string) string {
	return strings.Replace(strings.Replace(in, "\n", "⏎\n", -1), " ", "␣", -1)
}

func TestTable(t *testing.T) {
	table := genTableForTest(t)
	expected := `
 [0] alice,+3...   [alice 4h] hello!                                            
 [1] alice,+3...     [bob 2h] hello! wejoi fwoi jwe oiew oiwfowfw               
[10] alice,+3... [charlie 4h] hello! this is super long hahahaha blah blah bl...
[11] alice,+3... [charlie...] hello! hello!                                     
`
	out := &bytes.Buffer{}
	fmt.Fprintln(out)
	err := table.Render(out, " ", 80, []ColumnConstraint{10, 12, 12, Expandable})
	if err != nil {
		t.Fatal(err)
	}
	if out.String() != expected {
		t.Fatalf("wrong rendering result.\nGot:\n%s\nExpected:\n%s",
			readable(out.String()), readable(expected))
	}
}

func TestTableWrap(t *testing.T) {
	table := genTableForTest(t)
	expected := `
 [0] alice,+3...   [alice 4h] hello!                                            
 [1] alice,+3...     [bob 2h] hello! wejoi fwoi jwe oiew oiwfowfw               
[10] alice,+3... [charlie 4h] hello! this is super long hahahaha blah blah blah 
                              blah blah blah blah blah blah blah blah blah blah 
                              blah blah blah blah blah blah blah                
[11] alice,+3... [charlie...] hello! hello!                                     
`
	out := &bytes.Buffer{}
	fmt.Fprintln(out)
	err := table.Render(out, " ", 80, []ColumnConstraint{10, 12, 12, ExpandableWrappable})
	if err != nil {
		t.Fatal(err)
	}
	if out.String() != expected {
		t.Fatalf("wrong rendering result.\nGot:\n%s\nExpected:\n%s",
			readable(out.String()),
			readable(expected))
	}
}

func TestTableMultiline(t *testing.T) {
	table := genTableForTest(t)
	table.rows[1][3].Content = SingleCell{"first line\nsecond line\nblahblahblahblahblahblah supre long line hahaha aaa line line foo bar foo bar"}
	expected := `
 [0] alice,+3...   [alice 4h] hello!                                            
 [1] alice,+3...     [bob 2h] first line                                        
                              second line                                       
                              blahblahblahblahblahblah supre long line hahaha aa
                              a line line foo bar foo bar                       
[10] alice,+3... [charlie 4h] hello! this is super long hahahaha blah blah blah 
                              blah blah blah blah blah blah blah blah blah blah 
                              blah blah blah blah blah blah blah                
[11] alice,+3... [charlie...] hello! hello!                                     
`
	out := &bytes.Buffer{}
	fmt.Fprintln(out)
	err := table.Render(out, " ", 80, []ColumnConstraint{10, 12, 12, ExpandableWrappable})
	if err != nil {
		t.Fatal(err)
	}
	if out.String() != expected {
		t.Fatalf("wrong rendering result.\nGot:\n%s\nExpected:\n%s",
			readable(out.String()),
			readable(expected))
	}
}
