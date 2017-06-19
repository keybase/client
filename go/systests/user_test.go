// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"testing"
	"time"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

type signupInfo struct {
	username          string
	email             string
	passphrase        string
	displayedPaperKey string
}

type signupUI struct {
	baseNullUI
	info *signupInfo
	libkb.Contextified
}

type signupTerminalUI struct {
	info *signupInfo
	libkb.Contextified
}

type signupSecretUI struct {
	info *signupInfo
	libkb.Contextified
}

type signupLoginUI struct {
	libkb.Contextified
}

type signupGPGUI struct {
	libkb.Contextified
}

func (n *signupUI) GetTerminalUI() libkb.TerminalUI {
	return &signupTerminalUI{
		info:         n.info,
		Contextified: libkb.NewContextified(n.G()),
	}
}

func (n *signupUI) GetSecretUI() libkb.SecretUI {
	return &signupSecretUI{
		info:         n.info,
		Contextified: libkb.NewContextified(n.G()),
	}
}

func (n *signupUI) GetLoginUI() libkb.LoginUI {
	return client.NewLoginUI(n.GetTerminalUI(), false)
}

func (n *signupUI) GetGPGUI() libkb.GPGUI {
	return client.NewGPGUI(n.G(), n.GetTerminalUI(), false, "")
}

func (n *signupSecretUI) GetPassphrase(p keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (res keybase1.GetPassphraseRes, err error) {
	if p.Type == keybase1.PassphraseType_PAPER_KEY {
		res.Passphrase = n.info.displayedPaperKey
	} else {
		res.Passphrase = n.info.passphrase
	}
	n.G().Log.Debug("| GetPassphrase: %v -> %v", p, res)
	return res, err
}

func (n *signupTerminalUI) Prompt(pd libkb.PromptDescriptor, s string) (ret string, err error) {
	switch pd {
	case client.PromptDescriptorSignupUsername:
		ret = n.info.username
	case client.PromptDescriptorSignupEmail:
		ret = n.info.email
	case client.PromptDescriptorSignupDevice:
		ret = "work computer"
	case client.PromptDescriptorSignupCode:
		ret = "202020202020202020202020"
	default:
		err = fmt.Errorf("unknown prompt %v", pd)
	}
	n.G().Log.Debug("Terminal Prompt %d: %s -> %s (%v)\n", pd, s, ret, libkb.ErrToOk(err))
	return ret, err
}

func (n *signupTerminalUI) PromptPassword(pd libkb.PromptDescriptor, _ string) (string, error) {
	return "", nil
}
func (n *signupTerminalUI) Output(s string) error {
	n.G().Log.Debug("Terminal Output: %s", s)
	return nil
}
func (n *signupTerminalUI) OutputDesc(od libkb.OutputDescriptor, s string) error {
	switch od {
	case client.OutputDescriptorPrimaryPaperKey:
		n.info.displayedPaperKey = s
	}
	n.G().Log.Debug("Terminal Output %d: %s", od, s)
	return nil
}
func (n *signupTerminalUI) Printf(f string, args ...interface{}) (int, error) {
	s := fmt.Sprintf(f, args...)
	n.G().Log.Debug("Terminal Printf: %s", s)
	return len(s), nil
}

func (n *signupTerminalUI) Write(b []byte) (int, error) {
	n.G().Log.Debug("Terminal write: %s", string(b))
	return len(b), nil
}

func (n *signupTerminalUI) OutputWriter() io.Writer {
	return n
}
func (n *signupTerminalUI) ErrorWriter() io.Writer {
	return n
}

func (n *signupTerminalUI) PromptYesNo(pd libkb.PromptDescriptor, s string, def libkb.PromptDefault) (ret bool, err error) {
	switch pd {
	case client.PromptDescriptorLoginWritePaper:
		ret = true
	case client.PromptDescriptorLoginWallet:
		ret = true
	case client.PromptDescriptorGPGOKToAdd:
		ret = false
	default:
		err = fmt.Errorf("unknown prompt %v", pd)
	}
	n.G().Log.Debug("Terminal PromptYesNo %d: %s -> %s (%v)\n", pd, s, ret, libkb.ErrToOk(err))
	return ret, err
}

func (n *signupTerminalUI) PromptForConfirmation(prompt string) error {
	return nil
}

func (n *signupTerminalUI) Tablify(headings []string, rowfunc func() []string) {
	libkb.Tablify(n.OutputWriter(), headings, rowfunc)
}

func (n *signupTerminalUI) TerminalSize() (width int, height int) {
	return 80, 24
}

func randomUser(prefix string) *signupInfo {
	b := make([]byte, 5)
	rand.Read(b)
	sffx := hex.EncodeToString(b)
	username := fmt.Sprintf("%s_%s", prefix, sffx)
	return &signupInfo{
		username:   username,
		email:      username + "@noemail.keybase.io",
		passphrase: sffx + sffx,
	}
}

type notifyHandler struct {
	logoutCh    chan struct{}
	loginCh     chan string
	outOfDateCh chan keybase1.ClientOutOfDateArg
	userCh      chan keybase1.UID
	errCh       chan error
}

func newNotifyHandler() *notifyHandler {
	return &notifyHandler{
		logoutCh:    make(chan struct{}),
		loginCh:     make(chan string),
		outOfDateCh: make(chan keybase1.ClientOutOfDateArg),
		userCh:      make(chan keybase1.UID),
		errCh:       make(chan error),
	}
}

func (h *notifyHandler) LoggedOut(_ context.Context) error {
	h.logoutCh <- struct{}{}
	return nil
}

func (h *notifyHandler) LoggedIn(_ context.Context, un string) error {
	h.loginCh <- un
	return nil
}

func (h *notifyHandler) ClientOutOfDate(_ context.Context, arg keybase1.ClientOutOfDateArg) error {
	h.outOfDateCh <- arg
	return nil
}

func (h *notifyHandler) UserChanged(_ context.Context, uid keybase1.UID) error {
	h.userCh <- uid
	return nil
}

func TestSignupLogout(t *testing.T) {
	tc := setupTest(t, "signup")
	tc2 := cloneContext(tc)
	tc5 := cloneContext(tc)

	libkb.G.LocalDb = nil

	// Hack the various portions of the service that aren't
	// properly contextified.

	defer tc.Cleanup()

	stopCh := make(chan error)
	svc := service.NewService(tc.G, false)
	startCh := svc.GetStartChannel()
	go func() {
		err := svc.Run()
		if err != nil {
			t.Logf("Running the service produced an error: %v", err)
		}
		stopCh <- err
	}()

	userInfo := randomUser("sgnup")

	sui := signupUI{
		info:         userInfo,
		Contextified: libkb.NewContextified(tc2.G),
	}
	tc2.G.SetUI(&sui)
	signup := client.NewCmdSignupRunner(tc2.G)
	signup.SetTest()

	logout := client.NewCmdLogoutRunner(tc2.G)

	tc.G.Log.Debug("sleeping on server startCh")
	<-startCh
	tc.G.Log.Debug("waking on server startCh")

	nh := newNotifyHandler()

	// Launch the server that will listen for notifications on updates, such as logout
	launchServer := func(nh *notifyHandler) error {
		cli, xp, err := client.GetRPCClientWithContext(tc5.G)
		if err != nil {
			return err
		}
		srv := rpc.NewServer(xp, nil)
		if err = srv.Register(keybase1.NotifySessionProtocol(nh)); err != nil {
			return err
		}
		if err = srv.Register(keybase1.NotifyUsersProtocol(nh)); err != nil {
			return err
		}
		ncli := keybase1.NotifyCtlClient{Cli: cli}
		if err = ncli.SetNotifications(context.TODO(), keybase1.NotificationChannels{
			Session: true,
			Users:   true,
		}); err != nil {
			return err
		}
		return nil
	}

	// Actually launch it in the background
	go func() {
		err := launchServer(nh)
		if err != nil {
			nh.errCh <- err
		}
	}()

	if err := signup.Run(); err != nil {
		t.Fatal(err)
	}
	tc2.G.Log.Debug("Login State: %v", tc2.G.LoginState())
	select {
	case err := <-nh.errCh:
		t.Fatalf("Error before notify: %v", err)
	case u := <-nh.loginCh:
		if u != userInfo.username {
			t.Fatalf("bad username in login notifcation: %q != %q", u, userInfo.username)
		}
		tc.G.Log.Debug("Got notification of login for %q", u)
	}

	// signup calls logout, so clear that from the notification channel
	select {
	case <-nh.logoutCh:
	case <-time.After(20 * time.Second):
		t.Fatal("timed out waiting for signup's logout notification")
	}

	btc := client.NewCmdCurrencyAddRunner(tc2.G)
	btc.SetAddress("1HUCBSJeHnkhzrVKVjaVmWg2QtZS1mdfaz")
	if err := btc.Run(); err != nil {
		t.Fatal(err)
	}

	// Now let's be sure that we get a notification back as we expect.
	select {
	case err := <-nh.errCh:
		t.Fatalf("Error before notify: %v", err)
	case uid := <-nh.userCh:
		tc.G.Log.Debug("Got notification from user changed handled (%s)", uid)
		if e := libkb.CheckUIDAgainstUsername(uid, userInfo.username); e != nil {
			t.Fatalf("Bad UID back: %s != %s (%s)", uid, userInfo.username, e)
		}
	}

	// Fire a logout
	if err := logout.Run(); err != nil {
		t.Fatal(err)
	}

	// Now let's be sure that we get a notification back as we expect.
	select {
	case err := <-nh.errCh:
		t.Fatalf("Error before notify: %v", err)
	case <-nh.logoutCh:
		tc.G.Log.Debug("Got notification from logout handler")
	}

	tc.G.Log.Debug("Waiting for tc2 Ctl service stop")

	if err := client.CtlServiceStop(tc2.G); err != nil {
		t.Fatal(err)
	}

	tc.G.Log.Debug("Waiting for msg on stopCh")

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}

	tc.G.Log.Debug("Waiting for msg on logoutCh")

	// Check that we only get one notification, not two
	select {
	case _, ok := <-nh.logoutCh:
		if ok {
			t.Fatal("Received an extra logout notification!")
		}
	default:
	}

}
