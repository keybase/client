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
		newCreateOp("test1", BlockPointer{ID: BlockID{42}}, File),
		newRmOp("test2", BlockPointer{ID: BlockID{43}}))

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
