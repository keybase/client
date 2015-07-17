package libkbfs

import (
	"fmt"
	"runtime"
	"testing"

	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

type FakeBServerClient struct {
	blocks  map[keybase1.GetBlockArg]keybase1.GetBlockRes
	ctlChan chan struct{}
}

func NewFakeBServerClient(ctlChan chan struct{}) *FakeBServerClient {
	return &FakeBServerClient{
		blocks:  make(map[keybase1.GetBlockArg]keybase1.GetBlockRes),
		ctlChan: ctlChan,
	}
}

func (fc FakeBServerClient) maybeWaitOnChannel() {
	if fc.ctlChan != nil {
		// say we're ready, and wait for the signal to proceed
		fc.ctlChan <- struct{}{}
		<-fc.ctlChan
	}
}

func (fc FakeBServerClient) Call(s string, args interface{}, res interface{}) error {
	switch s {
	case "keybase.1.block.establishSession":
		// no need to do anything
		return nil

	case "keybase.1.block.putBlock":
		fc.maybeWaitOnChannel()
		putArgs := args.([]interface{})[0].(keybase1.PutBlockArg)
		fc.blocks[keybase1.GetBlockArg{Bid: putArgs.Bid}] =
			keybase1.GetBlockRes{BlockKey: putArgs.BlockKey, Buf: putArgs.Buf}
		return nil

	case "keybase.1.block.getBlock":
		fc.maybeWaitOnChannel()
		getArgs := args.([]interface{})[0].(keybase1.GetBlockArg)
		getRes := res.(*keybase1.GetBlockRes)
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

// Test that putting a block, and getting it back, works
func TestBServerRemotePutAndGet(t *testing.T) {
	codec := NewCodecMsgpack()
	localUsers := MakeLocalUsers([]string{"testuser"})
	loggedInUser := localUsers[0]
	kbpki := NewKBPKILocal(loggedInUser.UID, localUsers)
	config := &ConfigLocal{codec: codec, kbpki: kbpki}
	fc := NewFakeBServerClient(nil)
	ctx := context.Background()
	b := newBlockServerRemoteWithClient(ctx, config, fc)

	bID := BlockID{1}
	tlfID := TlfID{2}
	bCtx := BlockPointer{bID, 1, 1, kbpki.LoggedIn, zeroBlockRefNonce}
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
	if len(fc.blocks) != 1 {
		t.Errorf("There are %d blocks in the db, not 1 as expected",
			len(fc.blocks))
	}

	// Now get the same block back
	buf, key, err := b.Get(ctx, bID, bCtx)
	if err != nil {
		t.Fatalf("Get returned an error: %v", err)
	}
	if !bytesEqual(buf, data) {
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
	kbpki := NewKBPKILocal(loggedInUser.UID, localUsers)
	config := &ConfigLocal{codec: codec, kbpki: kbpki}
	ctlChan := make(chan struct{})
	fc := NewFakeBServerClient(ctlChan)

	f := func(ctx context.Context) error {
		b := newBlockServerRemoteWithClient(ctx, config, fc)

		bID := BlockID{1}
		tlfID := TlfID{2}
		bCtx := BlockPointer{bID, 1, 1, kbpki.LoggedIn, zeroBlockRefNonce}
		data := []byte{1, 2, 3, 4}
		crypto := &CryptoCommon{codec}
		serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
		if err != nil {
			t.Errorf("Couldn't make block server key half: %v", err)
		}
		err = b.Put(ctx, bID, tlfID, bCtx, data, serverHalf)
		return err
	}
	testWithCanceledContext(t, context.Background(), ctlChan, f)
}

// Test that RPCs wait for the bserver to connect to the backend
func TestBServerRemoteWaitForReconnect(t *testing.T) {
	codec := NewCodecMsgpack()
	localUsers := MakeLocalUsers([]string{"testuser"})
	loggedInUser := localUsers[0]
	kbpki := NewKBPKILocal(loggedInUser.UID, localUsers)
	config := &ConfigLocal{codec: codec, kbpki: kbpki}
	fc := NewFakeBServerClient(nil)
	ctx := context.Background()

	// make a new bserver, but don't connect it yes
	b := &BlockServerRemote{
		config:        config,
		connectedChan: make(chan struct{}),
		clt:           fc,
	}

	putChan := make(chan error)
	go func() {
		bID := BlockID{1}
		tlfID := TlfID{2}
		bCtx := BlockPointer{bID, 1, 1, kbpki.LoggedIn, zeroBlockRefNonce}
		data := []byte{1, 2, 3, 4}
		crypto := &CryptoCommon{codec}
		serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
		if err != nil {
			t.Errorf("Couldn't make block server key half: %v", err)
		}
		// wait til the test says to start
		<-putChan
		putChan <- b.Put(ctx, bID, tlfID, bCtx, data, serverHalf)
	}()

	// tell the put to start
	putChan <- nil
	// give the goroutine a chance to run
	runtime.Gosched()

	// Make sure there's no answer yet. Still a little racy (i.e.,
	// we're not 100% guaranteed the Put is waiting for the connect)
	// but that's ok.
	select {
	case <-putChan:
		t.Fatal("Got an answer from put before we connected!")
	default:
		// fall through to connecting
	}

	// Now allow it to connect
	err := b.ConnectOnce(ctx)
	if err != nil {
		t.Fatalf("ConnectOnce returned an error: %v", err)
	}

	// now there should be an answer waiting for us
	err = <-putChan
	if err != nil {
		t.Fatalf("Put got an error: %v", err)
	}

	// make sure it actually got to the db
	if len(fc.blocks) != 1 {
		t.Errorf("There are %d blocks in the db, not 1 as expected",
			len(fc.blocks))
	}
}
