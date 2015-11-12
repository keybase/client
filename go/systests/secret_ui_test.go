// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/service"
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func TestSecretUI(t *testing.T) {
	tc := setupTest(t, "secret_ui")
	tc1 := cloneContext(tc)
	tc2 := cloneContext(tc)

	// Make sure we're not using G anywhere in our tests.
	libkb.G.LocalDb = nil

	defer tc.Cleanup()

	stopCh := make(chan error)
	svc := service.NewService(false, tc.G)
	startCh := svc.GetStartChannel()
	go func() {
		err := svc.Run()
		if err != nil {
			t.Logf("Running the service produced an error: %v", err)
		}
		stopCh <- err
	}()

	// Wait for the server to start up
	<-startCh

	var err error
	check := func() {
		if err != nil {
			t.Fatal(err)
		}
	}

	sui := newSecretUI()
	cli, xp, err := client.GetRPCClientWithContext(tc2.G)
	check()
	srv := rpc.NewServer(xp, nil)
	err = srv.Register(keybase1.SecretUiProtocol(sui))
	check()
	ncli := keybase1.DelegateUiCtlClient{Cli: cli}
	err = ncli.RegisterSecretUI(context.TODO())
	check()

	// run login command

	stopper := client.NewCmdCtlStopRunner(tc1.G)
	if err := stopper.Run(); err != nil {
		t.Errorf("Error in stopping service: %v", err)
	}

	fmt.Printf("secret ui: %+v\n", sui)

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}

type secretUI struct {
	getKeybasePassphrase  bool
	getNewPassphrase      bool
	getPaperKeyPassphrase bool
	getSecret             bool
}

// secretUI implements the keybase1.IdentifyUiInterface
var _ keybase1.SecretUiInterface = (*secretUI)(nil)

func newSecretUI() *secretUI {
	return &secretUI{}
}

func (s *secretUI) GetKeybasePassphrase(context.Context, keybase1.GetKeybasePassphraseArg) (res keybase1.GetPassphraseRes, err error) {
	s.getKeybasePassphrase = true
	return res, nil
}

func (s *secretUI) GetNewPassphrase(context.Context, keybase1.GetNewPassphraseArg) (res keybase1.GetPassphraseRes, err error) {
	s.getNewPassphrase = true
	return res, nil
}

func (s *secretUI) GetPaperKeyPassphrase(context.Context, keybase1.GetPaperKeyPassphraseArg) (string, error) {
	s.getPaperKeyPassphrase = true
	return "", nil
}

func (s *secretUI) GetSecret(context.Context, keybase1.GetSecretArg) (res keybase1.SecretEntryRes, err error) {
	s.getSecret = true
	return res, nil
}
