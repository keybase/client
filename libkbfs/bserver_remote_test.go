// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"errors"
	"fmt"
	"sync"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

type FakeBServerClient struct {
	blocks     map[keybase1.GetBlockArg]keybase1.GetBlockRes
	blocksLock sync.Mutex
	readyChan  chan<- struct{}
	goChan     <-chan struct{}
	finishChan chan<- struct{}
}

func NewFakeBServerClient(
	readyChan chan<- struct{},
	goChan <-chan struct{},
	finishChan chan<- struct{}) *FakeBServerClient {
	return &FakeBServerClient{
		blocks:     make(map[keybase1.GetBlockArg]keybase1.GetBlockRes),
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

	fc.blocksLock.Lock()
	defer fc.blocksLock.Unlock()
	fc.blocks[keybase1.GetBlockArg{Bid: arg.Bid, Folder: arg.Folder}] =
		keybase1.GetBlockRes{BlockKey: arg.BlockKey, Buf: arg.Buf}
	return nil
}

func (fc *FakeBServerClient) GetBlock(ctx context.Context, arg keybase1.GetBlockArg) (keybase1.GetBlockRes, error) {
	err := fc.maybeWaitOnChannel(ctx)
	defer fc.maybeFinishOnChannel()
	if err != nil {
		return keybase1.GetBlockRes{}, err
	}

	fc.blocksLock.Lock()
	defer fc.blocksLock.Unlock()
	getRes, ok := fc.blocks[arg]
	if !ok {
		return keybase1.GetBlockRes{}, fmt.Errorf("No such block: %v", arg)
	}
	return getRes, nil
}

func (fc *FakeBServerClient) AddReference(context.Context, keybase1.AddReferenceArg) error {
	// Do nothing.
	return nil
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
	fc.blocksLock.Lock()
	defer fc.blocksLock.Unlock()
	return len(fc.blocks)
}

// Test that putting a block, and getting it back, works
func TestBServerRemotePutAndGet(t *testing.T) {
	codec := NewCodecMsgpack()
	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"testuser"})
	currentUID := localUsers[0].UID
	config := &ConfigLocal{codec: codec}
	setTestLogger(config, t)
	fc := NewFakeBServerClient(nil, nil, nil)
	b := newBlockServerRemoteWithClient(config, fc)

	bID := fakeBlockID(1)
	tlfID := FakeTlfID(2, false)
	bCtx := BlockContext{currentUID, "", zeroBlockRefNonce}
	data := []byte{1, 2, 3, 4}
	crypto := MakeCryptoCommon(config)
	serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
	if err != nil {
		t.Errorf("Couldn't make block server key half: %v", err)
	}
	ctx := context.Background()
	err = b.Put(ctx, bID, tlfID, bCtx, data, serverHalf)
	if err != nil {
		t.Fatalf("Put got error: %v", err)
	}

	// make sure it actually got to the db
	nb := fc.numBlocks()
	if nb != 1 {
		t.Errorf("There are %d blocks in the db, not 1 as expected", nb)
	}

	// Now get the same block back
	buf, key, err := b.Get(ctx, bID, tlfID, bCtx)
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
	codec := NewCodecMsgpack()
	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"testuser"})
	currentUID := localUsers[0].UID
	config := &ConfigLocal{codec: codec}
	setTestLogger(config, t)

	serverConn, conn := rpc.MakeConnectionForTest(t)
	b := newBlockServerRemoteWithClient(
		config, keybase1.BlockClient{Cli: conn.GetClient()})

	f := func(ctx context.Context) error {
		bID := fakeBlockID(1)
		tlfID := FakeTlfID(2, false)
		bCtx := BlockContext{currentUID, "", zeroBlockRefNonce}
		data := []byte{1, 2, 3, 4}
		crypto := MakeCryptoCommon(config)
		serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
		if err != nil {
			t.Errorf("Couldn't make block server key half: %v", err)
		}
		err = b.Put(ctx, bID, tlfID, bCtx, data, serverHalf)
		return err
	}
	testRPCWithCanceledContext(t, serverConn, f)
}
