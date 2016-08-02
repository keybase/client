// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"math/rand"
	"reflect"
	"testing"
	"time"

	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
)

func TestCreateOpCustomUpdate(t *testing.T) {
	oldDir := makeFakeBlockPointer(t)
	co, err := newCreateOp("name", oldDir, Exec)
	require.NoError(t, err)
	require.Equal(t, blockUpdate{Unref: oldDir}, co.Dir)

	// Update to oldDir should update co.Dir.
	newDir := oldDir
	newDir.ID = fakeBlockID(42)
	co.AddUpdate(oldDir, newDir)
	require.Nil(t, co.Updates)
	require.Equal(t, blockUpdate{Unref: oldDir, Ref: newDir}, co.Dir)
}

func TestRmOpCustomUpdate(t *testing.T) {
	oldDir := makeFakeBlockPointer(t)
	ro, err := newRmOp("name", oldDir)
	require.NoError(t, err)
	require.Equal(t, blockUpdate{Unref: oldDir}, ro.Dir)

	// Update to oldDir should update ro.Dir.
	newDir := oldDir
	newDir.ID = fakeBlockID(42)
	ro.AddUpdate(oldDir, newDir)
	require.Nil(t, ro.Updates)
	require.Equal(t, blockUpdate{Unref: oldDir, Ref: newDir}, ro.Dir)
}

func TestRenameOpCustomUpdateWithinDir(t *testing.T) {
	oldDir := makeFakeBlockPointer(t)
	renamed := oldDir
	renamed.ID = fakeBlockID(42)
	ro, err := newRenameOp(
		"old name", oldDir, "new name", oldDir,
		renamed, Exec)
	require.NoError(t, err)
	require.Equal(t, blockUpdate{Unref: oldDir}, ro.OldDir)
	require.Equal(t, BlockPointer{}, ro.NewDir.Unref)
	require.Equal(t, BlockPointer{}, ro.NewDir.Ref)

	// Update to oldDir should update ro.OldDir.
	newDir := oldDir
	newDir.ID = fakeBlockID(43)
	ro.AddUpdate(oldDir, newDir)
	require.Nil(t, ro.Updates)
	require.Equal(t, blockUpdate{Unref: oldDir, Ref: newDir}, ro.OldDir)
	require.Equal(t, blockUpdate{}, ro.NewDir)
}

func TestRenameOpCustomUpdateAcrossDirs(t *testing.T) {
	oldOldDir := makeFakeBlockPointer(t)
	oldNewDir := oldOldDir
	oldNewDir.ID = fakeBlockID(42)
	renamed := oldOldDir
	renamed.ID = fakeBlockID(43)
	ro, err := newRenameOp(
		"old name", oldOldDir, "new name", oldNewDir,
		renamed, Exec)
	require.NoError(t, err)
	require.Equal(t, blockUpdate{Unref: oldOldDir}, ro.OldDir)
	require.Equal(t, blockUpdate{Unref: oldNewDir}, ro.NewDir)

	// Update to oldOldDir should update ro.OldDir.
	newOldDir := oldOldDir
	newOldDir.ID = fakeBlockID(44)
	ro.AddUpdate(oldOldDir, newOldDir)
	require.Nil(t, ro.Updates)
	require.Equal(t, blockUpdate{Unref: oldOldDir, Ref: newOldDir}, ro.OldDir)
	require.Equal(t, blockUpdate{Unref: oldNewDir}, ro.NewDir)

	// Update to oldNewDir should update ro.OldDir.
	newNewDir := oldNewDir
	newNewDir.ID = fakeBlockID(45)
	ro.AddUpdate(oldNewDir, newNewDir)
	require.Nil(t, ro.Updates)
	require.Equal(t, blockUpdate{Unref: oldOldDir, Ref: newOldDir}, ro.OldDir)
	require.Equal(t, blockUpdate{Unref: oldNewDir, Ref: newNewDir}, ro.NewDir)
}

func TestSyncOpCustomUpdate(t *testing.T) {
	oldFile := makeFakeBlockPointer(t)
	so, err := newSyncOp(oldFile)
	require.NoError(t, err)
	require.Equal(t, blockUpdate{Unref: oldFile}, so.File)

	// Update to oldFile should update so.File.
	newFile := oldFile
	newFile.ID = fakeBlockID(42)
	so.AddUpdate(oldFile, newFile)
	require.Nil(t, so.Updates)
	require.Equal(t, blockUpdate{Unref: oldFile, Ref: newFile}, so.File)
}

func TestSetAttrOpCustomUpdate(t *testing.T) {
	oldDir := makeFakeBlockPointer(t)
	file := oldDir
	file.ID = fakeBlockID(42)
	sao, err := newSetAttrOp("name", oldDir, mtimeAttr, file)
	require.NoError(t, err)
	require.Equal(t, blockUpdate{Unref: oldDir}, sao.Dir)

	// Update to oldDir should update sao.Dir.
	newDir := oldDir
	newDir.ID = fakeBlockID(42)
	sao.AddUpdate(oldDir, newDir)
	require.Nil(t, sao.Updates)
	require.Equal(t, blockUpdate{Unref: oldDir, Ref: newDir}, sao.Dir)
}

type writeRangeFuture struct {
	WriteRange
	extra
}

func (wrf writeRangeFuture) toCurrent() WriteRange {
	return wrf.WriteRange
}

func (wrf writeRangeFuture) toCurrentStruct() currentStruct {
	return wrf.toCurrent()
}

func makeFakeWriteRangeFuture(t *testing.T) writeRangeFuture {
	wrf := writeRangeFuture{
		WriteRange{
			5,
			10,
			codec.UnknownFieldSetHandler{},
		},
		makeExtraOrBust("WriteRange", t),
	}
	return wrf
}

func TestWriteRangeUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeWriteRangeFuture(t))
}

// opPointerizerFuture and registerOpsFuture are the "future" versions
// of opPointerizer and RegisterOps. registerOpsFuture is used by
// testStructUnknownFields.

func opPointerizerFuture(iface interface{}) reflect.Value {
	switch op := iface.(type) {
	default:
		return reflect.ValueOf(iface)
	case createOpFuture:
		return reflect.ValueOf(&op)
	case rmOpFuture:
		return reflect.ValueOf(&op)
	case renameOpFuture:
		return reflect.ValueOf(&op)
	case syncOpFuture:
		return reflect.ValueOf(&op)
	case setAttrOpFuture:
		return reflect.ValueOf(&op)
	case resolutionOpFuture:
		return reflect.ValueOf(&op)
	case rekeyOpFuture:
		return reflect.ValueOf(&op)
	case gcOpFuture:
		return reflect.ValueOf(&op)
	}
}

func registerOpsFuture(codec Codec) {
	codec.RegisterType(reflect.TypeOf(createOpFuture{}), createOpCode)
	codec.RegisterType(reflect.TypeOf(rmOpFuture{}), rmOpCode)
	codec.RegisterType(reflect.TypeOf(renameOpFuture{}), renameOpCode)
	codec.RegisterType(reflect.TypeOf(syncOpFuture{}), syncOpCode)
	codec.RegisterType(reflect.TypeOf(setAttrOpFuture{}), setAttrOpCode)
	codec.RegisterType(reflect.TypeOf(resolutionOpFuture{}), resolutionOpCode)
	codec.RegisterType(reflect.TypeOf(rekeyOpFuture{}), rekeyOpCode)
	codec.RegisterType(reflect.TypeOf(gcOpFuture{}), gcOpCode)
	codec.RegisterIfaceSliceType(reflect.TypeOf(opsList{}), opsListCode,
		opPointerizerFuture)
}

type createOpFuture struct {
	createOp
	extra
}

func (cof createOpFuture) toCurrent() createOp {
	return cof.createOp
}

func (cof createOpFuture) toCurrentStruct() currentStruct {
	return cof.toCurrent()
}

func makeFakeBlockUpdate(t *testing.T) blockUpdate {
	return blockUpdate{
		makeFakeBlockPointer(t),
		makeFakeBlockPointer(t),
	}
}

func makeFakeOpCommon(t *testing.T, withRefBlocks bool) OpCommon {
	var refBlocks []BlockPointer
	if withRefBlocks {
		refBlocks = []BlockPointer{makeFakeBlockPointer(t)}
	}
	oc := OpCommon{
		refBlocks,
		[]BlockPointer{makeFakeBlockPointer(t)},
		[]blockUpdate{makeFakeBlockUpdate(t)},
		codec.UnknownFieldSetHandler{},
		writerInfo{},
		path{},
		time.Time{},
	}
	return oc
}

func makeFakeCreateOpFuture(t *testing.T) createOpFuture {
	cof := createOpFuture{
		createOp{
			makeFakeOpCommon(t, true),
			"new name",
			makeFakeBlockUpdate(t),
			Exec,
			false,
			false,
			"",
		},
		makeExtraOrBust("createOp", t),
	}
	return cof
}

func TestCreateOpUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeCreateOpFuture(t))
}

type rmOpFuture struct {
	rmOp
	extra
}

func (rof rmOpFuture) toCurrent() rmOp {
	return rof.rmOp
}

func (rof rmOpFuture) toCurrentStruct() currentStruct {
	return rof.toCurrent()
}

func makeFakeRmOpFuture(t *testing.T) rmOpFuture {
	rof := rmOpFuture{
		rmOp{
			makeFakeOpCommon(t, true),
			"old name",
			makeFakeBlockUpdate(t),
			false,
		},
		makeExtraOrBust("rmOp", t),
	}
	return rof
}

func TestRmOpUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeRmOpFuture(t))
}

type renameOpFuture struct {
	renameOp
	extra
}

func (rof renameOpFuture) toCurrent() renameOp {
	return rof.renameOp
}

func (rof renameOpFuture) toCurrentStruct() currentStruct {
	return rof.toCurrent()
}

func makeFakeRenameOpFuture(t *testing.T) renameOpFuture {
	rof := renameOpFuture{
		renameOp{
			makeFakeOpCommon(t, true),
			"old name",
			makeFakeBlockUpdate(t),
			"new name",
			makeFakeBlockUpdate(t),
			makeFakeBlockPointer(t),
			Exec,
		},
		makeExtraOrBust("renameOp", t),
	}
	return rof
}

func TestRenameOpUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeRenameOpFuture(t))
}

type syncOpFuture struct {
	syncOp
	// Overrides syncOp.Writes.
	Writes []writeRangeFuture `codec:"w"`
	extra
}

func (sof syncOpFuture) toCurrent() syncOp {
	so := sof.syncOp
	so.Writes = make([]WriteRange, len(sof.Writes))
	for i, w := range sof.Writes {
		so.Writes[i] = w.toCurrent()
	}
	return so
}

func (sof syncOpFuture) toCurrentStruct() currentStruct {
	return sof.toCurrent()
}

func makeFakeSyncOpFuture(t *testing.T) syncOpFuture {
	sof := syncOpFuture{
		syncOp{
			makeFakeOpCommon(t, true),
			makeFakeBlockUpdate(t),
			nil,
		},
		[]writeRangeFuture{
			makeFakeWriteRangeFuture(t),
			makeFakeWriteRangeFuture(t),
		},
		makeExtraOrBust("syncOp", t),
	}
	return sof
}

func TestSyncOpUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeSyncOpFuture(t))
}

type setAttrOpFuture struct {
	setAttrOp
	extra
}

func (sof setAttrOpFuture) toCurrent() setAttrOp {
	return sof.setAttrOp
}

func (sof setAttrOpFuture) toCurrentStruct() currentStruct {
	return sof.toCurrent()
}

func makeFakeSetAttrOpFuture(t *testing.T) setAttrOpFuture {
	sof := setAttrOpFuture{
		setAttrOp{
			makeFakeOpCommon(t, true),
			"name",
			makeFakeBlockUpdate(t),
			mtimeAttr,
			makeFakeBlockPointer(t),
		},
		makeExtraOrBust("setAttrOp", t),
	}
	return sof
}

func TestSetAttrOpUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeSetAttrOpFuture(t))
}

type resolutionOpFuture struct {
	resolutionOp
	extra
}

func (rof resolutionOpFuture) toCurrent() resolutionOp {
	return rof.resolutionOp
}

func (rof resolutionOpFuture) toCurrentStruct() currentStruct {
	return rof.toCurrent()
}

func makeFakeResolutionOpFuture(t *testing.T) resolutionOpFuture {
	rof := resolutionOpFuture{
		resolutionOp{
			makeFakeOpCommon(t, true),
		},
		makeExtraOrBust("resolutionOp", t),
	}
	return rof
}

func TestResolutionOpUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeResolutionOpFuture(t))
}

type rekeyOpFuture struct {
	rekeyOp
	extra
}

func (rof rekeyOpFuture) toCurrent() rekeyOp {
	return rof.rekeyOp
}

func (rof rekeyOpFuture) toCurrentStruct() currentStruct {
	return rof.toCurrent()
}

func makeFakeRekeyOpFuture(t *testing.T) rekeyOpFuture {
	rof := rekeyOpFuture{
		rekeyOp{
			makeFakeOpCommon(t, true),
		},
		makeExtraOrBust("rekeyOp", t),
	}
	return rof
}

func TestRekeyOpUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeRekeyOpFuture(t))
}

type gcOpFuture struct {
	gcOp
	extra
}

func (gof gcOpFuture) toCurrent() gcOp {
	return gof.gcOp
}

func (gof gcOpFuture) toCurrentStruct() currentStruct {
	return gof.toCurrent()
}

func makeFakeGcOpFuture(t *testing.T) gcOpFuture {
	gof := gcOpFuture{
		gcOp{
			makeFakeOpCommon(t, false),
			100,
		},
		makeExtraOrBust("gcOp", t),
	}
	return gof
}

func TestGcOpUnknownFields(t *testing.T) {
	testStructUnknownFields(t, makeFakeGcOpFuture(t))
}

type testOps struct {
	Ops []interface{}
}

// Tests that ops can be serialized and deserialized as extensions.
func TestOpSerialization(t *testing.T) {
	c := NewCodecMsgpack()
	RegisterOps(c)

	ops := testOps{}
	// add a couple ops of different types
	co, err := newCreateOp("test1", BlockPointer{ID: fakeBlockID(42)}, File)
	require.NoError(t, err)
	ro, err := newRmOp("test2", BlockPointer{ID: fakeBlockID(43)})
	require.NoError(t, err)
	ops.Ops = append(ops.Ops, co, ro)

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
	filePtr := BlockPointer{ID: fakeBlockID(44)}

	cop, err := newCreateOp("test1", oldPtr1, File)
	require.NoError(t, err)
	cop.AddUpdate(oldPtr1, newPtr1)
	cop.AddUpdate(oldPtr2, newPtr2)
	expectedIOp, err := newRmOp("test1", newPtr1)
	require.NoError(t, err)
	expectedIOp.AddUpdate(newPtr1, oldPtr1)
	expectedIOp.AddUpdate(newPtr2, oldPtr2)

	iop1, err := invertOpForLocalNotifications(cop)
	require.NoError(t, err)
	ro, ok := iop1.(*rmOp)
	if !ok || !reflect.DeepEqual(*ro, *expectedIOp) {
		t.Errorf("createOp didn't invert properly, expected %v, got %v",
			expectedIOp, iop1)
	}

	// convert it back (works because the inversion picks File as the
	// type, which is what we use above)
	iop2, err := invertOpForLocalNotifications(iop1)
	require.NoError(t, err)
	co, ok := iop2.(*createOp)
	if !ok || !reflect.DeepEqual(*co, *cop) {
		t.Errorf("rmOp didn't invert properly, expected %v, got %v",
			expectedIOp, iop2)
	}

	// rename
	rop, err := newRenameOp("old", oldPtr1, "new", oldPtr2, filePtr, File)
	require.NoError(t, err)
	rop.AddUpdate(oldPtr1, newPtr1)
	rop.AddUpdate(oldPtr2, newPtr2)
	expectedIOp3, err := newRenameOp("new", newPtr2, "old", newPtr1, filePtr, File)
	require.NoError(t, err)
	expectedIOp3.AddUpdate(newPtr1, oldPtr1)
	expectedIOp3.AddUpdate(newPtr2, oldPtr2)

	iop3, err := invertOpForLocalNotifications(rop)
	require.NoError(t, err)
	renameOp, ok := iop3.(*renameOp)
	if !ok || !reflect.DeepEqual(*renameOp, *expectedIOp3) {
		t.Errorf("renameOp didn't invert properly, expected %v, got %v",
			expectedIOp3, iop3)
	}

	// sync (writes should be the same as before)
	sop, err := newSyncOp(oldPtr1)
	require.NoError(t, err)
	sop.AddUpdate(oldPtr1, newPtr1)
	sop.addWrite(2, 3)
	sop.addTruncate(100)
	sop.addWrite(10, 12)
	expectedIOp4, err := newSyncOp(newPtr1)
	require.NoError(t, err)
	expectedIOp4.AddUpdate(newPtr1, oldPtr1)
	expectedIOp4.Writes = sop.Writes
	iop4, err := invertOpForLocalNotifications(sop)
	require.NoError(t, err)
	so, ok := iop4.(*syncOp)
	if !ok || !reflect.DeepEqual(*so, *expectedIOp4) {
		t.Errorf("syncOp didn't invert properly, expected %v, got %v",
			expectedIOp4, iop4)
	}

	// setAttr
	saop, err := newSetAttrOp("name", oldPtr1, mtimeAttr, filePtr)
	require.NoError(t, err)
	saop.AddUpdate(oldPtr1, newPtr1)
	expectedIOp5, err := newSetAttrOp("name", newPtr1, mtimeAttr, filePtr)
	require.NoError(t, err)
	expectedIOp5.AddUpdate(newPtr1, oldPtr1)
	iop5, err := invertOpForLocalNotifications(saop)
	require.NoError(t, err)
	sao, ok := iop5.(*setAttrOp)
	if !ok || !reflect.DeepEqual(*sao, *expectedIOp5) {
		t.Errorf("setAttrOp didn't invert properly, expected %v, got %v",
			expectedIOp5, iop5)
	}
}

func TestOpsCollapseWriteRange(t *testing.T) {
	const numAttempts = 1000
	const fileSize = uint64(1000)
	const numWrites = 25
	const maxWriteSize = uint64(50)
	for i := 0; i < numAttempts; i++ {
		// Make a "file" where dirty bytes are represented by trues.
		var file [fileSize]bool
		var lastByte uint64
		var lastByteIsTruncate bool
		var syncOps []*syncOp
		for j := 0; j < numWrites; j++ {
			// Start a new syncOp?
			if len(syncOps) == 0 || rand.Int()%5 == 0 {
				syncOps = append(syncOps, &syncOp{})
			}

			op := syncOps[len(syncOps)-1]
			// Generate either a random truncate or random write
			off := uint64(rand.Int()) % fileSize
			length := uint64(0)
			if rand.Int()%5 > 0 {
				// A write, not a truncate
				maxLen := fileSize - off
				if maxLen > maxWriteSize {
					maxLen = maxWriteSize
				}
				maxLen--
				if maxLen == 0 {
					maxLen = 1
				}
				// Writes must have at least one byte
				length = uint64(rand.Int())%maxLen + uint64(1)
				op.addWrite(off, length)
				// Fill in dirty bytes
				for k := off; k < off+length; k++ {
					file[k] = true
				}
				if lastByte < off+length {
					lastByte = off + length
				}
			} else {
				op.addTruncate(off)
				for k := off; k < fileSize; k++ {
					file[k] = false
				}
				lastByte = off
				lastByteIsTruncate = true
			}
		}

		var wrComputed []WriteRange
		for _, op := range syncOps {
			wrComputed = op.collapseWriteRange(wrComputed)
		}

		var wrExpected []WriteRange
		inWrite := false
		for j := 0; j < int(lastByte); j++ {
			if !inWrite && file[j] {
				inWrite = true
				wrExpected = append(wrExpected, WriteRange{Off: uint64(j)})
			} else if inWrite && !file[j] {
				inWrite = false
				wrExpected[len(wrExpected)-1].Len =
					uint64(j) - wrExpected[len(wrExpected)-1].Off
			}
		}
		if inWrite {
			wrExpected[len(wrExpected)-1].Len =
				lastByte - wrExpected[len(wrExpected)-1].Off
		}
		if lastByteIsTruncate {
			wrExpected = append(wrExpected, WriteRange{Off: lastByte})
		}

		// Verify that the write range represents what's in the file.
		if g, e := len(wrComputed), len(wrExpected); g != e {
			t.Errorf("Range lengths differ (%d vs %d)", g, e)
			continue
		}
		for j, wc := range wrComputed {
			we := wrExpected[j]
			if wc.Off != we.Off && wc.Len != we.Len {
				t.Errorf("Writes differ at index %d (%v vs %v)", j, we, wc)
			}
		}
	}
}

func ExamplecoalesceWrites() {
	fmt.Println(coalesceWrites(
		[]WriteRange{{Off: 7, Len: 5}, {Off: 18, Len: 10},
			{Off: 98, Len: 10}}, WriteRange{Off: 5, Len: 100}))
	// Output: [{5 103 {{map[]}}}]
}

func ExamplecoalesceWrites_withOldTruncate() {
	fmt.Println(coalesceWrites(
		[]WriteRange{{Off: 7, Len: 5}, {Off: 18, Len: 10},
			{Off: 98, Len: 0}}, WriteRange{Off: 5, Len: 100}))
	// Output: [{5 100 {{map[]}}} {105 0 {{map[]}}}]
}
