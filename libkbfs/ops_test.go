package libkbfs

import (
	"reflect"
	"testing"
)

type testOps struct {
	Ops []interface{}
}

// Tests that ops can be serialized and deserialized as extensions.
func TestOpSerialization(t *testing.T) {
	c := NewCodecMsgpack()
	RegisterOps(c)

	ops := testOps{}
	// add a couple ops of different types
	ops.Ops = append(ops.Ops,
		newCreateOp("test1", BlockPointer{ID: fakeBlockID(42)}, File),
		newRmOp("test2", BlockPointer{ID: fakeBlockID(43)}))

	buf, err := c.Encode(ops)
	if err != nil {
		t.Errorf("Couldn't encode ops: %v", err)
	}

	ops2 := testOps{}
	err = c.Decode(buf, &ops2)
	if err != nil {
		t.Errorf("Couldn't decode ops: %v", err)
	}

	op1, ok := ops2.Ops[0].(createOp)
	if !ok {
		t.Errorf("Couldn't decode createOp: %v", reflect.TypeOf(ops2.Ops[0]))
	} else if op1.NewName != "test1" {
		t.Errorf("Wrong name in createOp: %s", op1.NewName)
	}

	op2, ok := ops2.Ops[1].(rmOp)
	if !ok {
		t.Errorf("Couldn't decode rmOp: %v", reflect.TypeOf(ops2.Ops[1]))
	} else if op2.OldName != "test2" {
		t.Errorf("Wrong name in rmOp: %s", op2.OldName)
	}
}

func TestOpInversion(t *testing.T) {
	oldPtr1 := BlockPointer{ID: fakeBlockID(42)}
	newPtr1 := BlockPointer{ID: fakeBlockID(82)}
	oldPtr2 := BlockPointer{ID: fakeBlockID(43)}
	newPtr2 := BlockPointer{ID: fakeBlockID(83)}

	cop := newCreateOp("test1", oldPtr1, File)
	cop.AddUpdate(oldPtr1, newPtr1)
	cop.AddUpdate(oldPtr2, newPtr2)
	expectedIOp := newRmOp("test1", newPtr1)
	expectedIOp.AddUpdate(newPtr1, oldPtr1)
	expectedIOp.AddUpdate(newPtr2, oldPtr2)

	iop1, ok := invertOpForLocalNotifications(cop).(*rmOp)
	if !ok || !reflect.DeepEqual(*iop1, *expectedIOp) {
		t.Errorf("createOp didn't invert properly, expected %v, got %v",
			expectedIOp, iop1)
	}

	// convert it back (works because the inversion picks File as the
	// type, which is what we use above)
	iop2, ok := invertOpForLocalNotifications(iop1).(*createOp)
	if !ok || !reflect.DeepEqual(*iop2, *cop) {
		t.Errorf("rmOp didn't invert properly, expected %v, got %v",
			expectedIOp, iop2)
	}

	// rename
	rop := newRenameOp("old", oldPtr1, "new", oldPtr2)
	rop.AddUpdate(oldPtr1, newPtr1)
	rop.AddUpdate(oldPtr2, newPtr2)
	expectedIOp3 := newRenameOp("new", newPtr2, "old", newPtr1)
	expectedIOp3.AddUpdate(newPtr1, oldPtr1)
	expectedIOp3.AddUpdate(newPtr2, oldPtr2)

	iop3, ok := invertOpForLocalNotifications(rop).(*renameOp)
	if !ok || !reflect.DeepEqual(*iop3, *expectedIOp3) {
		t.Errorf("renameOp didn't invert properly, expected %v, got %v",
			expectedIOp3, iop3)
	}

	// sync (writes should be the same as before)
	sop := newSyncOp(oldPtr1)
	sop.AddUpdate(oldPtr1, newPtr1)
	sop.addWrite(2, 3)
	sop.addTruncate(100)
	sop.addWrite(10, 12)
	expectedIOp4 := newSyncOp(newPtr1)
	expectedIOp4.AddUpdate(newPtr1, oldPtr1)
	expectedIOp4.Writes = sop.Writes
	iop4, ok := invertOpForLocalNotifications(sop).(*syncOp)
	if !ok || !reflect.DeepEqual(*iop4, *expectedIOp4) {
		t.Errorf("syncOp didn't invert properly, expected %v, got %v",
			expectedIOp4, iop4)
	}

	// setAttr
	saop := newSetAttrOp("name", oldPtr1, mtimeAttr)
	saop.AddUpdate(oldPtr1, newPtr1)
	expectedIOp5 := newSetAttrOp("name", newPtr1, mtimeAttr)
	expectedIOp5.AddUpdate(newPtr1, oldPtr1)
	iop5, ok := invertOpForLocalNotifications(saop).(*setAttrOp)
	if !ok || !reflect.DeepEqual(*iop5, *expectedIOp5) {
		t.Errorf("setAttrOp didn't invert properly, expected %v, got %v",
			expectedIOp5, iop5)
	}
}
