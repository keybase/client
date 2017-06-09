package systests

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	"github.com/keybase/clockwork"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

// deviceWrapper wraps a mock "device", meaning an independent running service and
// some connected clients.
type deviceWrapper struct {
	tctx         *libkb.TestContext
	clones       []*libkb.TestContext
	stopCh       chan error
	service      *service.Service
	rekeyUI      *testRekeyUI
	deviceKey    keybase1.PublicKey
	rekeyClient  keybase1.RekeyClient
	userClient   keybase1.UserClient
	gregorClient keybase1.GregorClient
}

func (d *deviceWrapper) KID() keybase1.KID {
	return d.deviceKey.KID
}

func (d *deviceWrapper) start(numClones int) {
	for i := 0; i < numClones; i++ {
		d.clones = append(d.clones, cloneContext(d.tctx))
	}
	d.stopCh = make(chan error)
	svc := service.NewService(d.tctx.G, false)
	d.service = svc
	startCh := svc.GetStartChannel()
	go func() {
		d.stopCh <- svc.Run()
	}()
	<-startCh
}

func (d *deviceWrapper) stop() error {
	return <-d.stopCh
}

func (d *deviceWrapper) popClone() *libkb.TestContext {
	if len(d.clones) == 0 {
		panic("ran out of cloned environments")
	}
	ret := d.clones[0]
	d.clones = d.clones[1:]
	return ret
}

func (rkt *rekeyTester) getFakeTLF() *fakeTLF {
	if rkt.fakeTLF == nil {
		rkt.fakeTLF = newFakeTLF()
	}
	return rkt.fakeTLF
}

func (tlf *fakeTLF) nextRevision() int {
	tlf.revision++
	return tlf.revision
}

type rekeyTester struct {
	t          *testing.T
	log        logger.Logger
	devices    []*deviceWrapper
	fakeClock  clockwork.FakeClock
	backupKeys []backupKey
	fakeTLF    *fakeTLF
	username   string
}

func newRekeyTester(t *testing.T) *rekeyTester {
	return &rekeyTester{
		t: t,
	}
}

func (rkt *rekeyTester) setup(nm string) *deviceWrapper {
	rkt.fakeClock = clockwork.NewFakeClockAt(time.Now())
	newDevice := rkt.setupDevice(nm)
	rkt.log = newDevice.tctx.G.Log
	return newDevice
}

func (rkt *rekeyTester) setupDevice(nm string) *deviceWrapper {
	tctx := setupTest(rkt.t, nm)
	tctx.G.SetClock(rkt.fakeClock)
	ret := &deviceWrapper{tctx: tctx}
	rkt.devices = append(rkt.devices, ret)
	return ret
}

func (rkt *rekeyTester) primaryDevice() *deviceWrapper {
	return rkt.devices[0]
}

func (rkt *rekeyTester) primaryContext() *libkb.GlobalContext {
	return rkt.primaryDevice().tctx.G
}

func (rkt *rekeyTester) cleanup() {
	for _, od := range rkt.devices {
		od.tctx.Cleanup()
	}
}

type testRekeyUI struct {
	sessionID int
	refreshes chan keybase1.RefreshArg
	events    chan keybase1.RekeyEvent
}

func (ui *testRekeyUI) DelegateRekeyUI(_ context.Context) (int, error) {
	ui.sessionID++
	ret := ui.sessionID
	return ret, nil
}

func (ui *testRekeyUI) Refresh(_ context.Context, arg keybase1.RefreshArg) error {
	ui.refreshes <- arg
	return nil
}

func (ui *testRekeyUI) RekeySendEvent(_ context.Context, arg keybase1.RekeySendEventArg) error {
	ui.events <- arg.Event
	return nil
}

func newTestRekeyUI() *testRekeyUI {
	return &testRekeyUI{
		sessionID: 0,
		refreshes: make(chan keybase1.RefreshArg, 1000),
		events:    make(chan keybase1.RekeyEvent, 1000),
	}
}

func (rkt *rekeyTester) loadEncryptionKIDs() (devices []keybase1.KID, backups []backupKey) {
	keyMap := make(map[keybase1.KID]keybase1.PublicKey)
	keys, err := rkt.primaryDevice().userClient.LoadMyPublicKeys(context.TODO(), 0)
	if err != nil {
		rkt.t.Fatalf("Failed to LoadMyPublicKeys: %s", err)
	}
	for _, key := range keys {
		keyMap[key.KID] = key
	}

	for _, key := range keys {
		if key.IsSibkey {
			continue
		}
		parent, found := keyMap[keybase1.KID(key.ParentID)]
		if !found {
			continue
		}

		switch parent.DeviceType {
		case libkb.DeviceTypePaper:
			backups = append(backups, backupKey{KID: key.KID, deviceID: parent.DeviceID})
		case libkb.DeviceTypeDesktop:
			devices = append(devices, key.KID)
		default:
		}
	}
	return devices, backups
}

func (rkt *rekeyTester) signupUser(dw *deviceWrapper) {
	userInfo := randomUser("rekey")
	tctx := dw.popClone()
	g := tctx.G
	signupUI := signupUI{
		info:         userInfo,
		Contextified: libkb.NewContextified(g),
	}
	g.SetUI(&signupUI)
	signup := client.NewCmdSignupRunner(g)
	signup.SetTest()
	if err := signup.Run(); err != nil {
		rkt.t.Fatal(err)
	}
	rkt.t.Logf("signed up %s", userInfo.username)
	rkt.username = userInfo.username
	var backupKey backupKey
	devices, backups := rkt.loadEncryptionKIDs()
	if len(devices) != 1 {
		rkt.t.Fatalf("Expected 1 device back; got %d", len(devices))
	}
	if len(backups) != 1 {
		rkt.t.Fatalf("Expected 1 backup back; got %d", len(backups))
	}
	dw.deviceKey.KID = devices[0]
	backupKey = backups[0]
	backupKey.secret = signupUI.info.displayedPaperKey
	rkt.backupKeys = append(rkt.backupKeys, backupKey)
}

func (rkt *rekeyTester) startUIsAndClients(dw *deviceWrapper) {
	ui := newTestRekeyUI()
	dw.rekeyUI = ui
	tctx := dw.popClone()
	g := tctx.G

	launch := func() error {
		cli, xp, err := client.GetRPCClientWithContext(g)
		if err != nil {
			return err
		}
		srv := rpc.NewServer(xp, nil)
		if err = srv.Register(keybase1.RekeyUIProtocol(ui)); err != nil {
			return err
		}
		ncli := keybase1.DelegateUiCtlClient{Cli: cli}
		if err = ncli.RegisterRekeyUI(context.TODO()); err != nil {
			return err
		}
		dw.rekeyClient = keybase1.RekeyClient{Cli: cli}
		dw.userClient = keybase1.UserClient{Cli: cli}
		dw.gregorClient = keybase1.GregorClient{Cli: cli}
		return nil
	}

	if err := launch(); err != nil {
		rkt.t.Fatalf("Failed to launch rekey UI: %s", err)
	}
}

func (rkt *rekeyTester) confirmNoRekeyUIActivity(dw *deviceWrapper, hours int, force bool) {
	assertNoActivity := func(hour int) {
		for {
			select {
			case ev := <-dw.rekeyUI.events:
				rkt.log.Debug("Hour %d: got rekey event: %+v", hour, ev)
			case <-dw.rekeyUI.refreshes:
				rkt.t.Fatalf("Didn't expect any rekeys; got one at hour %d\n", hour)
			default:
				return
			}
		}
	}

	for i := 0; i < hours; i++ {
		assertNoActivity(i)
		rkt.fakeClock.Advance(time.Hour)
	}
	err := dw.rekeyClient.RekeySync(context.TODO(), keybase1.RekeySyncArg{SessionID: 0, Force: force})
	if err != nil {
		rkt.t.Errorf("Error syncing rekey: %s", err)
	}
	assertNoActivity(hours + 1)
}

func (rkt *rekeyTester) makeFullyKeyedHomeTLF() {
	kids := []keybase1.KID{}
	for _, dev := range rkt.devices {
		kids = append(kids, dev.deviceKey.KID)
	}
	for _, bkp := range rkt.backupKeys {
		kids = append(kids, bkp.KID)
	}
	rkt.changeKeysOnHomeTLF(kids)
}

func (rkt *rekeyTester) changeKeysOnHomeTLF(kids []keybase1.KID) {

	rkt.log.Debug("+ changeKeysOnHomeTLF(%v)", kids)
	defer rkt.log.Debug("- changeKeysOnHomeTLF")

	var kidStrings []string

	for _, kid := range kids {
		kidStrings = append(kidStrings, string(kid))
	}

	// Use the global context from the service for making API calls
	// to the API server.
	g := rkt.primaryContext()
	fakeTLF := rkt.getFakeTLF()
	apiArg := libkb.APIArg{
		Args: libkb.HTTPArgs{
			"tlfid":          libkb.S{Val: string(fakeTLF.id)},
			"kids":           libkb.S{Val: strings.Join(kidStrings, ",")},
			"folderRevision": libkb.I{Val: fakeTLF.nextRevision()},
		},
		Endpoint:    "test/fake_home_tlf",
		SessionType: libkb.APISessionTypeREQUIRED,
	}
	_, err := g.API.Post(apiArg)
	if err != nil {
		rkt.t.Fatalf("Failed to post fake TLF: %s", err)
	}
}

func (rkt *rekeyTester) bumpTLF(kid keybase1.KID) {

	rkt.log.Debug("+ bumpTLF(%s)", kid)
	defer rkt.log.Debug("- bumpTLF")

	// Use the global context from the service for making API calls
	// to the API server.
	g := rkt.primaryContext()

	apiArg := libkb.APIArg{
		Args: libkb.HTTPArgs{
			"kid": libkb.S{Val: string(kid)},
		},
		Endpoint:    "kbfs/bump_rekey",
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := g.API.Post(apiArg)
	if err != nil {
		rkt.t.Fatalf("Failed to bump rekey to front of line: %s", err)
	}
}

func (rkt *rekeyTester) kickRekeyd() {

	// Use the global context from the service for making API calls
	// to the API server.
	g := rkt.primaryContext()

	apiArg := libkb.APIArg{
		Endpoint: "test/accelerate_rekeyd",
		Args: libkb.HTTPArgs{
			"timeout": libkb.I{Val: 2000},
		},
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err := g.API.Post(apiArg)
	if err != nil {
		rkt.t.Errorf("Failed to accelerate rekeyd: %s", err)
	}
}

func (rkt *rekeyTester) assertRekeyWindowPushed(dw *deviceWrapper) {
	rkt.log.Debug("+ assertRekeyWindowPushed")
	select {
	case <-dw.rekeyUI.refreshes:
	case <-time.After(10 * time.Second):
		rkt.t.Fatalf("no gregor came in after 10s; something is broken")
	}
	rkt.log.Debug("- assertRekeyWindowPushed")
}

func (rkt *rekeyTester) consumeAllRekeyRefreshes(dw *deviceWrapper) int {
	i := 0
	rkt.log.Debug("consumeAllRekeyRefreshes")
	for {
		rkt.log.Debug("consumeAllRekeyRefreshes iter %d", i)
		select {
		case <-dw.rekeyUI.refreshes:
			i++
		default:
			return i
		}
	}
}

func (rkt *rekeyTester) clearAllEvents(dw *deviceWrapper) {
	loop := true
	rkt.log.Debug("+ clearing all events")
	for loop {
		select {
		case ev := <-dw.rekeyUI.events:
			rkt.log.Debug("| Got rekey event: %+v", ev)
		case r := <-dw.rekeyUI.refreshes:
			rkt.log.Debug("| Got refresh: %+v", r)
		default:
			loop = false
		}
	}
	rkt.log.Debug("- cleared all events")
}

func (rkt *rekeyTester) clearAllRefreshes(dw *deviceWrapper) {
	loop := true
	rkt.log.Debug("+ clearing all refreshes")
	for loop {
		select {
		case r := <-dw.rekeyUI.refreshes:
			rkt.log.Debug("| Got refresh: %+v", r)
		default:
			loop = false
		}
	}
	rkt.log.Debug("- cleared all refreshes")
}

func (rkt *rekeyTester) waitForEvent(dw *deviceWrapper, wanted service.RekeyInterrupt) {
	rkt.log.Debug("+ waitForEvent(%v)", wanted)
	defer rkt.log.Debug("- waitForEvent(%v)", wanted)
	timeout := 10 * time.Second
	for {
		select {
		case received := <-dw.rekeyUI.events:
			if received.InterruptType == int(wanted) {
				rkt.log.Debug("| found event!")
				return
			}
			rkt.log.Debug("| ignored event: %v", received)
		case <-time.After(timeout):
			rkt.t.Fatalf("Failed to get %d event after %s", wanted, timeout)
		}
	}
}

func (rkt *rekeyTester) snoozeRekeyWindow(dw *deviceWrapper) {
	rkt.log.Debug("+ -------- snoozeRekeyWindow ---------")
	defer rkt.log.Debug("- -------- snoozeRekeyWindow ---------")

	_, err := dw.rekeyClient.RekeyStatusFinish(context.TODO(), 0)
	if err != nil {
		rkt.t.Fatalf("Failed to finish rekey: %s\n", err)
	}

	// There might be a few stragglers --- that's OK, just clear
	// them out, but no more once we advance the clock!
	err = dw.rekeyClient.RekeySync(context.TODO(), keybase1.RekeySyncArg{SessionID: 0, Force: false})
	if err != nil {
		rkt.t.Fatalf("Failed to sync: %s", err)
	}
	rkt.clearAllEvents(dw)

	// Our snooze should be 23 hours long, and should be resistent
	// to interrupts.
	rkt.log.Debug("+ confirming no rekey activity (1)")
	rkt.confirmNoRekeyUIActivity(dw, 14, false)
	rkt.log.Debug("- confirmed / disconfirmed")
}

func (rkt *rekeyTester) confirmSnoozeContiues(dw *deviceWrapper) {

	rkt.log.Debug("+ -------- confirmSnoozeContiues ---------")
	defer rkt.log.Debug("- -------- confirmSnoozeContiues ---------")

	rkt.log.Debug("+ confirming no rekey activity (2)")
	rkt.confirmNoRekeyUIActivity(dw, 9, false)
	rkt.log.Debug("- confirmed / disconfirmed")
}

func (rkt *rekeyTester) confirmRekeyWakesUp(dw *deviceWrapper) {

	rkt.log.Debug("+ -------- confirmRekeyWakesUp ---------")
	defer rkt.log.Debug("- -------- confirmRekeyWakesUp ---------")

	// In 2 more hours, we should get rereminded
	rkt.fakeClock.Advance(2 * time.Hour)

	// Now sync so that we're sure we get a full run through the loop.
	err := dw.rekeyClient.RekeySync(context.TODO(), keybase1.RekeySyncArg{SessionID: 0, Force: false})
	if err != nil {
		rkt.t.Fatalf("Error syncing rekey: %s", err)
	}

	if numRefreshes := rkt.consumeAllRekeyRefreshes(dw); numRefreshes == 0 {
		rkt.t.Fatal("snoozed rekey window never came back")
	} else {
		rkt.log.Debug("Got %d refreshes", numRefreshes)
	}

	rkt.clearAllEvents(dw)
}

type rekeyBackupKeyUI struct {
	baseNullUI
	secret string
}

func (u *rekeyBackupKeyUI) DisplayPaperKeyPhrase(_ context.Context, arg keybase1.DisplayPaperKeyPhraseArg) error {
	u.secret = arg.Phrase
	return nil
}
func (u *rekeyBackupKeyUI) DisplayPrimaryPaperKey(context.Context, keybase1.DisplayPrimaryPaperKeyArg) error {
	return nil
}
func (u *rekeyBackupKeyUI) PromptRevokePaperKeys(context.Context, keybase1.PromptRevokePaperKeysArg) (bool, error) {
	return false, nil
}
func (u *rekeyBackupKeyUI) GetEmailOrUsername(context.Context, int) (string, error) {
	return "", nil
}

func (u *rekeyBackupKeyUI) GetLoginUI() libkb.LoginUI {
	return u
}

func (u *rekeyBackupKeyUI) GetSecretUI() libkb.SecretUI {
	return u
}

func (u *rekeyBackupKeyUI) GetPassphrase(p keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (res keybase1.GetPassphraseRes, err error) {
	return res, err
}

func (rkt *rekeyTester) findNewBackupKey(newList []backupKey) (ret backupKey, found bool) {
	for _, newBackup := range newList {
		tmpFound := false
		for _, existingBackup := range rkt.backupKeys {
			if newBackup.KID.Equal(existingBackup.KID) {
				tmpFound = true
				break
			}
		}
		if !tmpFound {
			return newBackup, true
		}
	}
	return ret, false
}

func (rkt *rekeyTester) findNewDeviceKey(newList []keybase1.KID) (ret keybase1.KID, found bool) {
	for _, newKID := range newList {
		tmpFound := false
		for _, device := range rkt.devices {
			if !device.KID().IsNil() && newKID.Equal(device.KID()) {
				tmpFound = true
				break
			}
		}
		if !tmpFound {
			return newKID, true
		}
	}
	return ret, false
}

func (rkt *rekeyTester) generateNewBackupKey(dw *deviceWrapper) {
	rkt.log.Debug("+ ----- generateNewBackupKey ---------")
	defer rkt.log.Debug("- ----- generateNewBackupKey ---------")
	tctx := dw.popClone()
	g := tctx.G
	ui := rekeyBackupKeyUI{}
	g.SetUI(&ui)
	paperGen := client.NewCmdPaperKeyRunner(g)
	if err := paperGen.Run(); err != nil {
		rkt.t.Fatal(err)
	}
	_, backups := rkt.loadEncryptionKIDs()
	backupKey, found := rkt.findNewBackupKey(backups)
	if !found {
		rkt.t.Fatalf("didn't find a new backup key!")
	}
	backupKey.secret = ui.secret
	g.Log.Debug("New backup key is: %s", backupKey.KID)

	rkt.backupKeys = append(rkt.backupKeys, backupKey)
	rkt.bumpTLF(backupKey.KID)
	rkt.kickRekeyd()
}

func (rkt *rekeyTester) expectAlreadyKeyedNoop(dw *deviceWrapper) {

	rkt.log.Debug("+ ----------- expectAlreadyKeyedNoop ------------")
	defer rkt.log.Debug("- ----------- expectAlreadyKeyedNoop ------------")

	var done bool
	for !done {
		select {
		case ev := <-dw.rekeyUI.events:
			switch ev.EventType {
			case keybase1.RekeyEventType_CURRENT_DEVICE_CAN_REKEY:
				done = true
			case keybase1.RekeyEventType_NO_GREGOR_MESSAGES, keybase1.RekeyEventType_NO_PROBLEMS:
				rkt.log.Debug("| In waiting for 'CURRENT_DEVICE_CAN_REKEY': %+v", ev)
			default:
				rkt.t.Fatalf("Got wrong event type: %+v", ev)
				done = true
			}
		case <-time.After(10 * time.Second):
			rkt.t.Fatal("Didn't get an event before 10s timeout")
		}
	}
	rkt.confirmNoRekeyUIActivity(dw, 28, false)
}

type rekeyProvisionUI struct {
	baseNullUI
	username  string
	backupKey backupKey
}

func (r *rekeyProvisionUI) GetEmailOrUsername(context.Context, int) (string, error) {
	return r.username, nil
}
func (r *rekeyProvisionUI) PromptRevokePaperKeys(context.Context, keybase1.PromptRevokePaperKeysArg) (ret bool, err error) {
	return false, nil
}
func (r *rekeyProvisionUI) DisplayPaperKeyPhrase(context.Context, keybase1.DisplayPaperKeyPhraseArg) error {
	return nil
}
func (r *rekeyProvisionUI) DisplayPrimaryPaperKey(context.Context, keybase1.DisplayPrimaryPaperKeyArg) error {
	return nil
}
func (r *rekeyProvisionUI) ChooseProvisioningMethod(context.Context, keybase1.ChooseProvisioningMethodArg) (ret keybase1.ProvisionMethod, err error) {
	return ret, nil
}
func (r *rekeyProvisionUI) ChooseGPGMethod(context.Context, keybase1.ChooseGPGMethodArg) (ret keybase1.GPGMethod, err error) {
	return ret, nil
}
func (r *rekeyProvisionUI) SwitchToGPGSignOK(context.Context, keybase1.SwitchToGPGSignOKArg) (ret bool, err error) {
	return ret, nil
}
func (r *rekeyProvisionUI) ChooseDeviceType(context.Context, keybase1.ChooseDeviceTypeArg) (ret keybase1.DeviceType, err error) {
	return ret, nil
}
func (r *rekeyProvisionUI) DisplayAndPromptSecret(context.Context, keybase1.DisplayAndPromptSecretArg) (ret keybase1.SecretResponse, err error) {
	return ret, nil
}
func (r *rekeyProvisionUI) DisplaySecretExchanged(context.Context, int) error {
	return nil
}
func (r *rekeyProvisionUI) PromptNewDeviceName(context.Context, keybase1.PromptNewDeviceNameArg) (ret string, err error) {
	return "taco tsar", nil
}
func (r *rekeyProvisionUI) ProvisioneeSuccess(context.Context, keybase1.ProvisioneeSuccessArg) error {
	return nil
}
func (r *rekeyProvisionUI) ProvisionerSuccess(context.Context, keybase1.ProvisionerSuccessArg) error {
	return nil
}
func (r *rekeyProvisionUI) ChooseDevice(context.Context, keybase1.ChooseDeviceArg) (ret keybase1.DeviceID, err error) {
	return r.backupKey.deviceID, nil
}
func (r *rekeyProvisionUI) GetPassphrase(context.Context, keybase1.GetPassphraseArg) (ret keybase1.GetPassphraseRes, err error) {
	ret.Passphrase = r.backupKey.secret
	return ret, nil
}

func (rkt *rekeyTester) provisionNewDevice() *deviceWrapper {
	rkt.log.Debug("+ ---------- provisionNewDevice ----------")
	defer rkt.log.Debug("- ---------- provisionNewDevice ----------")

	dev2 := rkt.setupDevice("rkd2")
	dev2.start(1)
	tctx := dev2.popClone()
	g := tctx.G
	var loginClient keybase1.LoginClient
	ui := &rekeyProvisionUI{username: rkt.username, backupKey: rkt.backupKeys[0]}
	rekeyUI := newTestRekeyUI()
	dev2.rekeyUI = rekeyUI

	launch := func() error {
		cli, xp, err := client.GetRPCClientWithContext(g)
		if err != nil {
			return err
		}
		srv := rpc.NewServer(xp, nil)
		protocols := []rpc.Protocol{
			keybase1.LoginUiProtocol(ui),
			keybase1.SecretUiProtocol(ui),
			keybase1.ProvisionUiProtocol(ui),
			keybase1.RekeyUIProtocol(rekeyUI),
		}
		for _, prot := range protocols {
			if err = srv.Register(prot); err != nil {
				return err
			}
		}
		ncli := keybase1.DelegateUiCtlClient{Cli: cli}
		if err = ncli.RegisterRekeyUI(context.TODO()); err != nil {
			return err
		}
		loginClient = keybase1.LoginClient{Cli: cli}
		_ = loginClient
		dev2.rekeyClient = keybase1.RekeyClient{Cli: cli}
		return nil
	}

	if err := launch(); err != nil {
		rkt.t.Fatalf("Failed to login rekey UI: %s", err)
	}
	cmd := client.NewCmdLoginRunner(g)
	if err := cmd.Run(); err != nil {
		rkt.t.Fatalf("Login failed: %s\n", err)
	}

	var found bool
	devices, _ := rkt.loadEncryptionKIDs()
	dev2.deviceKey.KID, found = rkt.findNewDeviceKey(devices)
	if !found {
		rkt.t.Fatalf("Failed to failed device kid for new device")
	}
	rkt.log.Debug("new device KID: %s", dev2.deviceKey.KID)

	// Clear the paper key because we don't want it hanging around to
	// solve the problems we're trying to induce.
	err := dev2.tctx.G.LoginState().Account(func(a *libkb.Account) {
		a.ClearPaperKeys()
	}, "provisionNewDevice")

	if err != nil {
		rkt.t.Fatalf("failed to clear keys: %s", err)
	}

	return dev2
}

func (rkt *rekeyTester) bumpTLFAndAssertRekeyWindowPushed(dw *deviceWrapper) {

	rkt.log.Debug("+ -------- bumpTLFAndAssertRekeyWindowPushed ------------")
	defer rkt.log.Debug("- -------- bumpTLFAndAssertRekeyWindowPushed ------------")

	// We shouldn't get a rekey UI until we bump the TLF forward (and therefore get a gregor
	// message). We're cheating here and mixing fast-forwardable time (via fake clock),
	// and real time (on the API server).
	//
	// NOTE(maxtaco): 2016-12-08
	//
	// Disable the following since it was breaking CI on a windows node with a clock
	// skew:
	//
	// rkt.confirmNoRekeyUIActivity(dw, 3, false)

	// But now we're bumping this device forward in the queue. This should trigger the gregor
	// notification and also the push of the real rekey window.
	rkt.bumpTLF(dw.deviceKey.KID)

	rkt.kickRekeyd()
	rkt.assertRekeyWindowPushed(dw)
}

func (rkt *rekeyTester) confirmRekeyDismiss(dw *deviceWrapper) {
	err := dw.rekeyClient.RekeySync(context.TODO(), keybase1.RekeySyncArg{SessionID: 0, Force: false})
	if err != nil {
		rkt.t.Fatalf("failed to sync: %s", err)
	}
	found := false
	done := false
	for !found && !done {
		select {
		case rf := <-dw.rekeyUI.refreshes:
			n := len(rf.ProblemSetDevices.ProblemSet.Tlfs)
			if n == 0 {
				found = true
			} else {
				rkt.log.Debug("found a refresh with tlfs=%d: %v", n, rf)
			}
		default:
			done = true
		}
	}
	if !found {
		rkt.t.Fatalf("failed to find a refresh UI dismissal")
	}
}

func (rkt *rekeyTester) isGregorStateEmpty() (ret bool) {
	rkt.log.Debug("+ isGregorStateEmpty")
	defer func() { rkt.log.Debug(fmt.Sprintf("- isGregorStateEmpty -> %v", ret)) }()
	state, err := rkt.primaryDevice().gregorClient.GetState(context.TODO())
	if err != nil {
		rkt.log.Warning("failed to query gregor state: %s", err)
		return false
	}

	for _, item := range state.Items_ {
		if item.Item_ != nil && string(item.Item_.Category_) == service.TLFRekeyGregorCategory {
			rkt.log.Debug("Found an unexpected Gregor Item: %v", item)
			return false
		}
	}
	return true
}

func (rkt *rekeyTester) confirmGregorStateIsClean() {
	rkt.log.Debug("+ confirmGregorStateIsClean")
	defer rkt.log.Debug("- confirmGregorStateIsClean")

	start := time.Now()
	last := start.Add(3 * time.Second)
	i := 0
	var delay time.Duration

	for time.Now().Before(last) {
		if rkt.isGregorStateEmpty() {
			return
		}
		if delay < time.Second {
			delay += 10 * time.Millisecond
		}
		rkt.log.Debug("came back dirty; trying again in %s (attempt %d)", delay, i)
		time.Sleep(delay)
		i++
	}
	rkt.t.Fatal("Failed to find a clean gregor state")
}

func (rkt *rekeyTester) fullyRekeyAndAssertCleared(dw *deviceWrapper) {
	rkt.log.Debug("+ fullyRekeyAndAssertCleared")
	defer rkt.log.Debug("- fullyRekeyAndAssertCleared")

	rkt.makeFullyKeyedHomeTLF()
	rkt.confirmNoRekeyUIActivity(dw, 14, false)
	rkt.confirmGregorStateIsClean()
	rkt.confirmNoRekeyUIActivity(dw, 14, false)
}

func TestRekey(t *testing.T) {
	rkt := newRekeyTester(t)
	primaryDevice := rkt.setup("rekey")
	defer rkt.cleanup()

	// 0. Start up the primary device; Set numClones=4, meaning we're going to clone
	// the context 4 times (one for each client that will connect).
	primaryDevice.start(4)
	rkt.startUIsAndClients(primaryDevice)

	// 1. Sign up a fake user with a device and paper key
	rkt.signupUser(primaryDevice)

	// 2. Make a private home TLF keyed only for the device key (not the paper)
	rkt.makeFullyKeyedHomeTLF()

	// 3. Assert no rekey activity
	rkt.confirmNoRekeyUIActivity(primaryDevice, 28, false)

	// 4. Now delegate to a new paper key
	rkt.generateNewBackupKey(primaryDevice)

	// 5. Now assert that we weren't notified of something being up
	// because our device is already properly keyed. And then expect
	// no rekey activity thereafter
	rkt.expectAlreadyKeyedNoop(primaryDevice)

	// 5.5 Now rekey fully and make sure that the gregor state is clean.
	rkt.fullyRekeyAndAssertCleared(primaryDevice)

	// 6. Provision a new device.
	secondaryDevice := rkt.provisionNewDevice()

	// 7. wait for an incoming gregor notification for the new TLF,
	// since it's in a broken rekey state.
	rkt.bumpTLFAndAssertRekeyWindowPushed(secondaryDevice)

	// 8. But nothing should happen to the existing (primary) device.
	rkt.expectAlreadyKeyedNoop(primaryDevice)

	// 9. Dismiss the window and assert it doesn't show up again for
	// another 24 hours.
	rkt.snoozeRekeyWindow(secondaryDevice)

	// 10. Generate a new backup key, but make sure the snooze still holds.
	// For some reason, this doesn't work on the secondary dervice.
	// Merg. But shouldn't really matter.
	rkt.generateNewBackupKey(primaryDevice)

	// 11. Confirm that the snooze still continues after the above new key.
	rkt.confirmSnoozeContiues(secondaryDevice)

	// 12. After about 2 hours of sleeping, we should wake up since
	// our 24 hours is over.
	rkt.confirmRekeyWakesUp(secondaryDevice)

	// 13. no go about resolving all of the broken TLFs
	rkt.makeFullyKeyedHomeTLF()

	// 14. Assert that the rekey UI on the secondary device is dismissed.
	rkt.confirmRekeyDismiss(secondaryDevice)

	// 15. Now confirm that nothing is doing...
	rkt.confirmNoRekeyUIActivity(secondaryDevice, 30, true)

	// 16. Confirm that gregor is clean
	rkt.confirmGregorStateIsClean()
}
