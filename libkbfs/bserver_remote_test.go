package libkbfs

import (
	"bytes"
	"fmt"
	"runtime"
	"sync"
	"testing"

	keybase1 "github.com/keybase/client/protocol/go"
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
		blocks:    make(map[keybase1.GetBlockArg]keybase1.GetBlockRes),
		readyChan: readyChan,
		goChan:    goChan,
	}
}

func (fc *FakeBServerClient) maybeWaitOnChannel() {
	if fc.readyChan != nil {
		// say we're ready, and wait for the signal to proceed
		fc.readyChan <- struct{}{}
		<-fc.goChan
	}
}

func (fc *FakeBServerClient) maybeFinishOnChannel() {
	if fc.finishChan != nil {
		fc.finishChan <- struct{}{}
	}
}

func (fc *FakeBServerClient) Call(s string, args interface{},
	res interface{}) error {
	switch s {
	case "keybase.1.block.establishSession":
		// no need to do anything
		return nil

	case "keybase.1.block.putBlock":
		fc.maybeWaitOnChannel()
		defer fc.maybeFinishOnChannel()
		putArgs := args.([]interface{})[0].(keybase1.PutBlockArg)
		fc.blocksLock.Lock()
		defer fc.blocksLock.Unlock()
		fc.blocks[keybase1.GetBlockArg{Bid: putArgs.Bid}] =
			keybase1.GetBlockRes{BlockKey: putArgs.BlockKey, Buf: putArgs.Buf}
		return nil

	case "keybase.1.block.getBlock":
		fc.maybeWaitOnChannel()
		defer fc.maybeFinishOnChannel()
		getArgs := args.([]interface{})[0].(keybase1.GetBlockArg)
		getRes := res.(*keybase1.GetBlockRes)
		fc.blocksLock.Lock()
		defer fc.blocksLock.Unlock()
		getRes2, ok := fc.blocks[getArgs]
		*getRes = getRes2
		if !ok {
			return fmt.Errorf("No such block: %v", getArgs)
		}
		return nil

	default:
		return fmt.Errorf("Unknown call: %s %v %v", s, args, res)
	}
}

func (fc *FakeBServerClient) numBlocks() int {
	fc.blocksLock.Lock()
	defer fc.blocksLock.Unlock()
	return len(fc.blocks)
}

// Test that putting a block, and getting it back, works
func TestBServerRemotePutAndGet(t *testing.T) {
	codec := NewCodecMsgpack()
	localUsers := MakeLocalUsers([]string{"testuser"})
	loggedInUser := localUsers[0]
	kbpki := NewKBPKIMemory(loggedInUser.UID, localUsers)
	config := &ConfigLocal{codec: codec, kbpki: kbpki}
	fc := NewFakeBServerClient(nil, nil, nil)
	ctx := context.Background()
	b := newBlockServerRemoteWithClient(ctx, config, fc)

	bID := fakeBlockID(1)
	tlfID := FakeTlfID(2, false)
	bCtx := BlockPointer{bID, 1, 1, kbpki.LoggedIn, "", zeroBlockRefNonce}
	data := []byte{1, 2, 3, 4}
	crypto := &CryptoCommon{codec}
	serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
	if err != nil {
		t.Errorf("Couldn't make block server key half: %v", err)
	}
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
	buf, key, err := b.Get(ctx, bID, bCtx)
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
	localUsers := MakeLocalUsers([]string{"testuser"})
	loggedInUser := localUsers[0]
	kbpki := NewKBPKIMemory(loggedInUser.UID, localUsers)
	config := &ConfigLocal{codec: codec, kbpki: kbpki}
	readyChan := make(chan struct{})
	goChan := make(chan struct{})
	fc := NewFakeBServerClient(readyChan, goChan, nil)

	f := func(ctx context.Context) error {
		b := newBlockServerRemoteWithClient(ctx, config, fc)

		bID := fakeBlockID(1)
		tlfID := FakeTlfID(2, false)
		bCtx := BlockPointer{bID, 1, 1, kbpki.LoggedIn, "", zeroBlockRefNonce}
		data := []byte{1, 2, 3, 4}
		crypto := &CryptoCommon{codec}
		serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
		if err != nil {
			t.Errorf("Couldn't make block server key half: %v", err)
		}
		err = b.Put(ctx, bID, tlfID, bCtx, data, serverHalf)
		return err
	}
	testWithCanceledContext(t, context.Background(), readyChan, goChan, f)
}
