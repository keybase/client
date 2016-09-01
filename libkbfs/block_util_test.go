package libkbfs

import (
	"errors"
	"testing"
)

func TestBlockUtilPutNewBlockSuccess(t *testing.T) {
	mockCtrl, config, ctx := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to put a block
	id := fakeBlockID(1)
	encData := []byte{1, 2, 3, 4}
	blockPtr := BlockPointer{ID: id}

	tlfID := FakeTlfID(1, false)

	readyBlockData := ReadyBlockData{
		buf: encData,
	}

	config.mockBserv.EXPECT().Put(ctx, tlfID, id, blockPtr.BlockContext,
		readyBlockData.buf, readyBlockData.serverHalf).Return(nil)

	if err := putBlockToServer(ctx, config.BlockServer(), tlfID, blockPtr,
		readyBlockData); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestBlockUtilPutIncRefSuccess(t *testing.T) {
	mockCtrl, config, ctx := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

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

	config.mockBserv.EXPECT().AddBlockReference(ctx, kmd.TlfID(), id, blockPtr.BlockContext).
		Return(nil)

	if err := putBlockToServer(ctx, config.BlockServer(), kmd.TlfID(),
		blockPtr, readyBlockData); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestBlockUtilPutFail(t *testing.T) {
	mockCtrl, config, ctx := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// fail the put call
	id := fakeBlockID(1)
	encData := []byte{1, 2, 3, 4}
	blockPtr := BlockPointer{ID: id}

	err := errors.New("Fake fail")

	tlfID := FakeTlfID(1, false)

	readyBlockData := ReadyBlockData{
		buf: encData,
	}

	config.mockBserv.EXPECT().Put(ctx, tlfID, id, blockPtr.BlockContext,
		readyBlockData.buf, readyBlockData.serverHalf).Return(err)

	if err2 := putBlockToServer(ctx, config.BlockServer(), tlfID, blockPtr,
		readyBlockData); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}
