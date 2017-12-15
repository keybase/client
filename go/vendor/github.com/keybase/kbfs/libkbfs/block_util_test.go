package libkbfs

import (
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
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
	id := kbfsblock.FakeID(1)
	encData := []byte{1, 2, 3, 4}
	blockPtr := BlockPointer{ID: id}

	tlfID := tlf.FakeID(1, tlf.Private)

	readyBlockData := ReadyBlockData{
		buf: encData,
	}

	bserver.EXPECT().Put(ctx, tlfID, id, blockPtr.Context,
		readyBlockData.buf, readyBlockData.serverHalf).Return(nil)

	err := putBlockToServer(ctx, bserver, tlfID, blockPtr, readyBlockData)
	require.NoError(t, err)
}

func TestBlockUtilPutIncRefSuccess(t *testing.T) {
	mockCtrl, ctr, bserver, ctx := blockUtilInit(t)
	defer blockUtilShutdown(mockCtrl, ctr)

	// expect one call to put a block
	id := kbfsblock.FakeID(1)
	encData := []byte{1, 2, 3, 4}
	nonce := kbfsblock.RefNonce([8]byte{1, 2, 3, 4, 5, 6, 7, 8})
	blockPtr := BlockPointer{
		ID: id,
		Context: kbfsblock.Context{
			RefNonce: nonce,
		},
	}

	tlfID := tlf.FakeID(0, tlf.Private)

	readyBlockData := ReadyBlockData{
		buf: encData,
	}

	bserver.EXPECT().AddBlockReference(ctx, tlfID, id,
		blockPtr.Context).Return(nil)

	err := putBlockToServer(ctx, bserver, tlfID, blockPtr, readyBlockData)
	require.NoError(t, err)
}

func TestBlockUtilPutFail(t *testing.T) {
	mockCtrl, ctr, bserver, ctx := blockUtilInit(t)
	defer blockUtilShutdown(mockCtrl, ctr)

	// fail the put call
	id := kbfsblock.FakeID(1)
	encData := []byte{1, 2, 3, 4}
	blockPtr := BlockPointer{ID: id}

	expectedErr := errors.New("Fake fail")

	tlfID := tlf.FakeID(1, tlf.Private)

	readyBlockData := ReadyBlockData{
		buf: encData,
	}

	bserver.EXPECT().Put(ctx, tlfID, id, blockPtr.Context,
		readyBlockData.buf, readyBlockData.serverHalf).Return(
		expectedErr)

	err := putBlockToServer(ctx, bserver, tlfID, blockPtr, readyBlockData)
	require.Equal(t, expectedErr, err)
}
