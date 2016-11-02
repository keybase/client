package libkbfs

import (
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

func blockUtilInit(t *testing.T) (mockCtrl *gomock.Controller,
	ctr *SafeTestReporter, bserver *MockBlockServer, ctx context.Context) {
	ctr = NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	bserver = NewMockBlockServer(mockCtrl)
	ctx = context.Background()
	return mockCtrl, ctr, bserver, ctx
}

func blockUtilShutdown(mockCtrl *gomock.Controller, ctr *SafeTestReporter) {
	ctr.CheckForFailures()
	mockCtrl.Finish()
}

func TestBlockUtilPutNewBlockSuccess(t *testing.T) {
	mockCtrl, ctr, bserver, ctx := blockUtilInit(t)
	defer blockUtilShutdown(mockCtrl, ctr)

	// expect one call to put a block
	id := fakeBlockID(1)
	encData := []byte{1, 2, 3, 4}
	blockPtr := BlockPointer{ID: id}

	tlfID := tlf.FakeID(1, false)

	readyBlockData := ReadyBlockData{
		buf: encData,
	}

	bserver.EXPECT().Put(ctx, tlfID, id, blockPtr.BlockContext,
		readyBlockData.buf, readyBlockData.serverHalf).Return(nil)

	if err := putBlockToServer(ctx, bserver, tlfID, blockPtr,
		readyBlockData); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestBlockUtilPutIncRefSuccess(t *testing.T) {
	mockCtrl, ctr, bserver, ctx := blockUtilInit(t)
	defer blockUtilShutdown(mockCtrl, ctr)

	// expect one call to put a block
	id := fakeBlockID(1)
	encData := []byte{1, 2, 3, 4}
	nonce := BlockRefNonce([8]byte{1, 2, 3, 4, 5, 6, 7, 8})
	blockPtr := BlockPointer{
		ID: id,
		BlockContext: BlockContext{
			RefNonce: nonce,
		},
	}

	kmd := makeKMD()

	readyBlockData := ReadyBlockData{
		buf: encData,
	}

	bserver.EXPECT().AddBlockReference(ctx, kmd.TlfID(), id,
		blockPtr.BlockContext).Return(nil)

	if err := putBlockToServer(ctx, bserver, kmd.TlfID(), blockPtr,
		readyBlockData); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestBlockUtilPutFail(t *testing.T) {
	mockCtrl, ctr, bserver, ctx := blockUtilInit(t)
	defer blockUtilShutdown(mockCtrl, ctr)

	// fail the put call
	id := fakeBlockID(1)
	encData := []byte{1, 2, 3, 4}
	blockPtr := BlockPointer{ID: id}

	err := errors.New("Fake fail")

	tlfID := tlf.FakeID(1, false)

	readyBlockData := ReadyBlockData{
		buf: encData,
	}

	bserver.EXPECT().Put(ctx, tlfID, id, blockPtr.BlockContext,
		readyBlockData.buf, readyBlockData.serverHalf).Return(err)

	if err2 := putBlockToServer(ctx, bserver, tlfID, blockPtr,
		readyBlockData); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}
