// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"errors"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type FakeBServerClient struct {
	bserverMem *BlockServerMemory

	readyChan  chan<- struct{}
	goChan     <-chan struct{}
	finishChan chan<- struct{}
}

func NewFakeBServerClient(
	config Config,
	readyChan chan<- struct{},
	goChan <-chan struct{},
	finishChan chan<- struct{}) *FakeBServerClient {
	return &FakeBServerClient{
		bserverMem: NewBlockServerMemory(
			blockServerLocalConfigAdapter{config}),
		readyChan:  readyChan,
		goChan:     goChan,
		finishChan: finishChan,
	}
}

func (fc *FakeBServerClient) maybeWaitOnChannel(ctx context.Context) error {
	if fc.readyChan == nil {
		return nil
	}

	// say we're ready, and wait for a signal to proceed or a
	// cancellation.
	fc.readyChan <- struct{}{}
	select {
	case <-fc.goChan:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (fc *FakeBServerClient) maybeFinishOnChannel() {
	if fc.finishChan != nil {
		fc.finishChan <- struct{}{}
	}
}

func (fc *FakeBServerClient) GetSessionChallenge(context.Context) (keybase1.ChallengeInfo, error) {
	return keybase1.ChallengeInfo{}, errors.New("GetSessionChallenge not implemented")
}

func (fc *FakeBServerClient) AuthenticateSession(context.Context, string) error {
	return errors.New("AuthenticateSession not implemented")
}

func (fc *FakeBServerClient) PutBlock(ctx context.Context, arg keybase1.PutBlockArg) error {
	err := fc.maybeWaitOnChannel(ctx)
	defer fc.maybeFinishOnChannel()
	if err != nil {
		return err
	}

	id, err := BlockIDFromString(arg.Bid.BlockHash)
	if err != nil {
		return err
	}

	tlfID, err := tlf.ParseID(arg.Folder)
	if err != nil {
		return err
	}

	serverHalf, err := kbfscrypto.ParseBlockCryptKeyServerHalf(arg.BlockKey)
	if err != nil {
		return err
	}

	bCtx := BlockContext{
		RefNonce: ZeroBlockRefNonce,
		Creator:  arg.Bid.ChargedTo,
	}
	return fc.bserverMem.Put(ctx, tlfID, id, bCtx, arg.Buf, serverHalf)
}

func (fc *FakeBServerClient) GetBlock(ctx context.Context, arg keybase1.GetBlockArg) (keybase1.GetBlockRes, error) {
	err := fc.maybeWaitOnChannel(ctx)
	defer fc.maybeFinishOnChannel()
	if err != nil {
		return keybase1.GetBlockRes{}, err
	}

	id, err := BlockIDFromString(arg.Bid.BlockHash)
	if err != nil {
		return keybase1.GetBlockRes{}, err
	}

	tlfID, err := tlf.ParseID(arg.Folder)
	if err != nil {
		return keybase1.GetBlockRes{}, err
	}

	// Always use this block context (the one the block was
	// originally put with) since the RPC API doesn't pass along
	// all the info from the block context passed into
	// BlockServer.Get().
	bCtx := BlockContext{
		RefNonce: ZeroBlockRefNonce,
		Creator:  arg.Bid.ChargedTo,
	}

	data, serverHalf, err := fc.bserverMem.Get(ctx, tlfID, id, bCtx)
	if err != nil {
		return keybase1.GetBlockRes{}, err
	}
	return keybase1.GetBlockRes{
		BlockKey: serverHalf.String(),
		Buf:      data,
	}, nil
}

func (fc *FakeBServerClient) AddReference(ctx context.Context, arg keybase1.AddReferenceArg) error {
	id, err := BlockIDFromString(arg.Ref.Bid.BlockHash)
	if err != nil {
		return err
	}

	tlfID, err := tlf.ParseID(arg.Folder)
	if err != nil {
		return err
	}

	bCtx := BlockContext{
		RefNonce: BlockRefNonce(arg.Ref.Nonce),
		Creator:  arg.Ref.ChargedTo,
	}

	return fc.bserverMem.AddBlockReference(ctx, tlfID, id, bCtx)
}

func (fc *FakeBServerClient) DelReference(context.Context, keybase1.DelReferenceArg) error {
	return errors.New("DelReference not implemented")
}

func (fc *FakeBServerClient) DelReferenceWithCount(context.Context, keybase1.DelReferenceWithCountArg) (
	res keybase1.DowngradeReferenceRes, err error) {
	return res, errors.New("DelReferenceWithCount not implemented")
}

func (fc *FakeBServerClient) ArchiveReference(context.Context, keybase1.ArchiveReferenceArg) ([]keybase1.BlockReference, error) {
	return nil, errors.New("ArchiveReference not implemented")
}

func (fc *FakeBServerClient) ArchiveReferenceWithCount(context.Context, keybase1.ArchiveReferenceWithCountArg) (
	res keybase1.DowngradeReferenceRes, err error) {
	return res, errors.New("ArchiveReference not implemented")
}

func (fc *FakeBServerClient) GetUserQuotaInfo(context.Context) ([]byte, error) {
	return nil, errors.New("GetUserQuotaInfo not implemented")
}

func (fc *FakeBServerClient) numBlocks() int {
	return fc.bserverMem.numBlocks()
}

// Test that putting a block, and getting it back, works
func TestBServerRemotePutAndGet(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"user1", "user2"})
	currentUID := localUsers[0].UID
	crypto := &CryptoLocal{CryptoCommon: MakeCryptoCommon(codec)}
	config := &ConfigLocal{codec: codec, crypto: crypto}
	setTestLogger(config, t)
	fc := NewFakeBServerClient(config, nil, nil, nil)
	b := newBlockServerRemoteWithClient(config, fc)

	tlfID := tlf.FakeID(2, false)
	bCtx := BlockContext{currentUID, "", ZeroBlockRefNonce}
	data := []byte{1, 2, 3, 4}
	bID, err := crypto.MakePermanentBlockID(data)
	if err != nil {
		t.Fatal(err)
	}

	serverHalf, err := config.Crypto().MakeRandomBlockCryptKeyServerHalf()
	if err != nil {
		t.Errorf("Couldn't make block server key half: %v", err)
	}
	ctx := context.Background()
	err = b.Put(ctx, tlfID, bID, bCtx, data, serverHalf)
	if err != nil {
		t.Fatalf("Put got error: %v", err)
	}

	// make sure it actually got to the db
	nb := fc.numBlocks()
	if nb != 1 {
		t.Errorf("There are %d blocks in the db, not 1 as expected", nb)
	}

	// Now get the same block back
	buf, key, err := b.Get(ctx, tlfID, bID, bCtx)
	if err != nil {
		t.Fatalf("Get returned an error: %v", err)
	}
	if !bytes.Equal(buf, data) {
		t.Errorf("Got bad data -- got %v, expected %v", buf, data)
	}
	if key != serverHalf {
		t.Errorf("Got bad key -- got %v, expected %v", key, serverHalf)
	}

	// Add a reference.
	nonce, err := crypto.MakeBlockRefNonce()
	if err != nil {
		t.Fatal(err)
	}
	bCtx2 := BlockContext{currentUID, localUsers[1].UID, nonce}
	err = b.AddBlockReference(ctx, tlfID, bID, bCtx2)
	if err != nil {
		t.Fatal(err)
	}

	// Now get the same block back
	buf, key, err = b.Get(ctx, tlfID, bID, bCtx2)
	if err != nil {
		t.Fatalf("Get returned an error: %v", err)
	}
	if !bytes.Equal(buf, data) {
		t.Errorf("Got bad data -- got %v, expected %v", buf, data)
	}
	if key != serverHalf {
		t.Errorf("Got bad key -- got %v, expected %v", key, serverHalf)
	}
}

// If we cancel the RPC before the RPC returns, the call should error quickly.
func TestBServerRemotePutCanceled(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"testuser"})
	currentUID := localUsers[0].UID
	crypto := &CryptoLocal{CryptoCommon: MakeCryptoCommon(codec)}
	config := &ConfigLocal{codec: codec, crypto: crypto}
	setTestLogger(config, t)

	serverConn, conn := rpc.MakeConnectionForTest(t)
	b := newBlockServerRemoteWithClient(
		config, keybase1.BlockClient{Cli: conn.GetClient()})

	f := func(ctx context.Context) error {
		bID := fakeBlockID(1)
		tlfID := tlf.FakeID(2, false)
		bCtx := BlockContext{currentUID, "", ZeroBlockRefNonce}
		data := []byte{1, 2, 3, 4}
		serverHalf, err :=
			config.Crypto().MakeRandomBlockCryptKeyServerHalf()
		if err != nil {
			t.Errorf("Couldn't make block server key half: %v", err)
		}
		err = b.Put(ctx, tlfID, bID, bCtx, data, serverHalf)
		return err
	}
	testRPCWithCanceledContext(t, serverConn, f)
}
