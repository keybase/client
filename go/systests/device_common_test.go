package systests

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
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

//
// device_common_test is common utilities for testing multiple devices;
// for instance, to test rekey reminders on device revoke.
//

// Used for provisioning users and new devices within our testing framework
type testUI struct {
	libkb.Contextified
	baseNullUI
	sessionID          int
	outputDescHook     func(libkb.OutputDescriptor, string) error
	promptHook         func(libkb.PromptDescriptor, string) (string, error)
	promptPasswordHook func(libkb.PromptDescriptor, string) (string, error)
	promptYesNoHook    func(libkb.PromptDescriptor, string, libkb.PromptDefault) (bool, error)
}

var sessionCounter = 1

func newTestUI(g *libkb.GlobalContext) *testUI {
	x := sessionCounter
	sessionCounter++
	return &testUI{Contextified: libkb.NewContextified(g), sessionID: x}
}

func (t *testUI) GetTerminalUI() libkb.TerminalUI {
	return t
}

func (t *testUI) Write(b []byte) (int, error) {
	t.G().Log.Debug("Terminal write: %s", string(b))
	return len(b), nil
}

func (t *testUI) ErrorWriter() io.Writer {
	return t
}

func (t *testUI) Output(s string) error {
	t.G().Log.Debug("Terminal Output: %s", s)
	return nil
}

func (t *testUI) OutputDesc(d libkb.OutputDescriptor, s string) error {
	if t.outputDescHook != nil {
		return t.outputDescHook(d, s)
	}
	return t.Output(s)
}

func (t *testUI) OutputWriter() io.Writer {
	return t
}

func (t *testUI) Printf(f string, args ...interface{}) (int, error) {
	s := fmt.Sprintf(f, args...)
	t.G().Log.Debug("Terminal Printf: %s", s)
	return len(s), nil
}

func (t *testUI) Prompt(d libkb.PromptDescriptor, s string) (string, error) {
	if t.promptHook != nil {
		return t.promptHook(d, s)
	}
	return "", fmt.Errorf("Unhandled prompt: %q (%d)", s, d)
}

func (t *testUI) PromptForConfirmation(p string) error {
	return fmt.Errorf("unhandled prompt for confirmation: %q", p)
}

func (t *testUI) PromptPassword(d libkb.PromptDescriptor, s string) (string, error) {
	return "", fmt.Errorf("unhandled prompt for password: %q (%d)", s, d)
}

func (t *testUI) PromptYesNo(d libkb.PromptDescriptor, s string, def libkb.PromptDefault) (bool, error) {
	if t.promptYesNoHook != nil {
		return t.promptYesNoHook(d, s, def)
	}
	return false, fmt.Errorf("unhandled yes/no prompt: %q (%d)", s, d)
}

func (t *testUI) Tablify(headings []string, rowfunc func() []string) {
	libkb.Tablify(t.OutputWriter(), headings, rowfunc)
}

func (t *testUI) TerminalSize() (width int, height int) {
	return 80, 24
}

type backupKey struct {
	KID      keybase1.KID
	deviceID keybase1.DeviceID
	secret   string
}

// testDevice wraps a mock "device", meaning an independent running service and
// some connected clients. It's forked from deviceWrapper in rekey_test.
type testDevice struct {
	t          *testing.T
	tctx       *libkb.TestContext
	clones     []*libkb.TestContext
	stopCh     chan error
	service    *service.Service
	testUI     *testUI
	deviceID   keybase1.DeviceID
	deviceName string
	deviceKey  keybase1.PublicKey
	cli        *rpc.Client
	srv        *rpc.Server
	userClient keybase1.UserClient
}

type testDeviceSet struct {
	t          *testing.T
	log        logger.Logger
	devices    []*testDevice
	fakeClock  clockwork.FakeClock
	backupKeys []backupKey
	username   string
	uid        keybase1.UID
}

func (d *testDevice) startService(numClones int) {
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

func (d *testDevice) KID() keybase1.KID { return d.deviceKey.KID }

func (d *testDevice) startClient() {
	tctx := d.popClone()
	g := tctx.G
	ui := newTestUI(g)
	d.testUI = ui
	launch := func() error {
		cli, xp, err := client.GetRPCClientWithContext(g)
		if err != nil {
			return err
		}
		srv := rpc.NewServer(xp, nil)
		d.cli = cli
		d.srv = srv
		d.userClient = keybase1.UserClient{Cli: cli}
		return nil
	}

	if err := launch(); err != nil {
		d.t.Fatalf("Failed to launch rekey UI: %s", err)
	}
}

func (d *testDevice) start(numClones int) *testDevice {
	d.startService(numClones)
	d.startClient()
	return d
}

func (d *testDevice) stop() error {
	return <-d.stopCh
}

func (d *testDevice) popClone() *libkb.TestContext {
	if len(d.clones) == 0 {
		panic("ran out of cloned environments")
	}
	ret := d.clones[0]
	d.clones = d.clones[1:]
	return ret
}

func newTestDeviceSet(t *testing.T, cl clockwork.FakeClock) *testDeviceSet {
	if cl == nil {
		cl = clockwork.NewFakeClockAt(time.Now())
	}
	return &testDeviceSet{
		t:         t,
		fakeClock: cl,
	}
}

func (s *testDeviceSet) cleanup() {
	for _, od := range s.devices {
		od.tctx.Cleanup()
	}
}

func (s *testDeviceSet) newDevice(nm string) *testDevice {
	tctx := setupTest(s.t, nm)
	tctx.G.SetClock(s.fakeClock)

	// Opportunistically take a log as soon as we make one.
	if s.log == nil {
		s.log = tctx.G.Log
	}

	ret := &testDevice{t: s.t, tctx: tctx, deviceName: nm}
	s.devices = append(s.devices, ret)
	return ret
}

func (d *testDevice) loadEncryptionKIDs() (devices []keybase1.KID, backups []backupKey) {
	keyMap := make(map[keybase1.KID]keybase1.PublicKey)
	keys, err := d.userClient.LoadMyPublicKeys(context.TODO(), 0)
	if err != nil {
		d.t.Fatalf("Failed to LoadMyPublicKeys: %s", err)
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

func (d *testDevice) loadDeviceList() []keybase1.Device {
	cli := keybase1.DeviceClient{Cli: d.cli}
	devices, err := cli.DeviceList(context.TODO(), 0)
	if err != nil {
		d.t.Fatalf("devices: %s", err)
	}
	var ret []keybase1.Device
	for _, device := range devices {
		if device.Type == "desktop" {
			ret = append(ret, device)
		}

	}
	return ret
}

func (s *testDeviceSet) signupUser(dev *testDevice) {
	userInfo := randomUser("rekey")
	tctx := dev.popClone()
	g := tctx.G
	signupUI := signupUI{
		info:         userInfo,
		Contextified: libkb.NewContextified(g),
	}
	g.SetUI(&signupUI)
	signup := client.NewCmdSignupRunner(g)
	signup.SetTest()
	if err := signup.Run(); err != nil {
		s.t.Fatal(err)
	}
	s.t.Logf("signed up %s", userInfo.username)
	s.username = userInfo.username
	s.uid = libkb.UsernameToUID(s.username)
	var backupKey backupKey
	deviceKeys, backups := dev.loadEncryptionKIDs()
	if len(deviceKeys) != 1 {
		s.t.Fatalf("Expected 1 device back; got %d", len(deviceKeys))
	}
	if len(backups) != 1 {
		s.t.Fatalf("Expected 1 backup back; got %d", len(backups))
	}
	dev.deviceKey.KID = deviceKeys[0]
	backupKey = backups[0]
	backupKey.secret = signupUI.info.displayedPaperKey
	s.backupKeys = append(s.backupKeys, backupKey)

	devices := dev.loadDeviceList()
	if len(devices) != 1 {
		s.t.Fatalf("Expected 1 device back; got %d", len(devices))
	}
	dev.deviceID = devices[0].DeviceID
}

type testProvisionUI struct {
	baseNullUI
	username   string
	deviceName string
	backupKey  backupKey
}

func (r *testProvisionUI) GetEmailOrUsername(context.Context, int) (string, error) {
	return r.username, nil
}
func (r *testProvisionUI) PromptRevokePaperKeys(context.Context, keybase1.PromptRevokePaperKeysArg) (ret bool, err error) {
	return false, nil
}
func (r *testProvisionUI) DisplayPaperKeyPhrase(context.Context, keybase1.DisplayPaperKeyPhraseArg) error {
	return nil
}
func (r *testProvisionUI) DisplayPrimaryPaperKey(context.Context, keybase1.DisplayPrimaryPaperKeyArg) error {
	return nil
}
func (r *testProvisionUI) ChooseProvisioningMethod(context.Context, keybase1.ChooseProvisioningMethodArg) (ret keybase1.ProvisionMethod, err error) {
	return ret, nil
}
func (r *testProvisionUI) ChooseGPGMethod(context.Context, keybase1.ChooseGPGMethodArg) (ret keybase1.GPGMethod, err error) {
	return ret, nil
}
func (r *testProvisionUI) SwitchToGPGSignOK(context.Context, keybase1.SwitchToGPGSignOKArg) (ret bool, err error) {
	return ret, nil
}
func (r *testProvisionUI) ChooseDeviceType(context.Context, keybase1.ChooseDeviceTypeArg) (ret keybase1.DeviceType, err error) {
	return ret, nil
}
func (r *testProvisionUI) DisplayAndPromptSecret(context.Context, keybase1.DisplayAndPromptSecretArg) (ret keybase1.SecretResponse, err error) {
	return ret, nil
}
func (r *testProvisionUI) DisplaySecretExchanged(context.Context, int) error {
	return nil
}
func (r *testProvisionUI) PromptNewDeviceName(context.Context, keybase1.PromptNewDeviceNameArg) (ret string, err error) {
	return r.deviceName, nil
}
func (r *testProvisionUI) ProvisioneeSuccess(context.Context, keybase1.ProvisioneeSuccessArg) error {
	return nil
}
func (r *testProvisionUI) ProvisionerSuccess(context.Context, keybase1.ProvisionerSuccessArg) error {
	return nil
}
func (r *testProvisionUI) ChooseDevice(context.Context, keybase1.ChooseDeviceArg) (ret keybase1.DeviceID, err error) {
	return r.backupKey.deviceID, nil
}
func (r *testProvisionUI) GetPassphrase(context.Context, keybase1.GetPassphraseArg) (ret keybase1.GetPassphraseRes, err error) {
	ret.Passphrase = r.backupKey.secret
	return ret, nil
}

func (s *testDeviceSet) findNewKIDs(newList []keybase1.KID) []keybase1.KID {
	var ret []keybase1.KID
	for _, newKID := range newList {
		tmpFound := false
		for _, device := range s.devices {
			if !device.KID().IsNil() && newKID.Equal(device.KID()) {
				tmpFound = true
				break
			}
		}
		if !tmpFound {
			ret = append(ret, newKID)
		}
	}
	return ret
}

func (s *testDeviceSet) findNewDevices(newList []keybase1.Device) []keybase1.Device {
	var ret []keybase1.Device
	for _, newDevice := range newList {
		tmpFound := false
		for _, device := range s.devices {
			if !device.deviceID.IsNil() && newDevice.DeviceID.Eq(device.deviceID) {
				tmpFound = true
				break
			}
		}
		if !tmpFound {
			ret = append(ret, newDevice)
		}
	}
	return ret
}

func (s *testDeviceSet) provision(d *testDevice) {
	tctx := d.popClone()
	g := tctx.G
	var loginClient keybase1.LoginClient
	ui := &testProvisionUI{username: s.username, backupKey: s.backupKeys[0], deviceName: d.deviceName}

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
		}
		for _, prot := range protocols {
			if err = srv.Register(prot); err != nil {
				return err
			}
		}
		loginClient = keybase1.LoginClient{Cli: cli}
		return nil
	}

	if err := launch(); err != nil {
		s.t.Fatalf("Failed to login rekey UI: %s", err)
	}
	cmd := client.NewCmdLoginRunner(g)
	if err := cmd.Run(); err != nil {
		s.t.Fatalf("Login failed: %s\n", err)
	}

	deviceKeys, backups := d.loadEncryptionKIDs()
	deviceKeys = s.findNewKIDs(deviceKeys)
	if len(deviceKeys) != 1 {
		s.t.Fatalf("expected 1 new device encryption key")
	}
	d.deviceKey.KID = deviceKeys[0]
	if len(backups) != 1 {
		s.t.Fatalf("expected 1 backup key only")
	}
	devices := s.findNewDevices(d.loadDeviceList())
	if len(devices) != 1 {
		s.t.Fatalf("expected 1 device ID; got %d", len(devices))
	}
	d.deviceID = devices[0].DeviceID
}

func (s *testDeviceSet) provisionNewDevice(name string, numClones int) *testDevice {
	ret := s.newDevice(name)
	ret.start(numClones + 1)
	s.provision(ret)
	return ret
}

func newTLFID() keybase1.TLFID {
	var b []byte
	b, err := libkb.RandBytes(16)
	if err != nil {
		return ""
	}
	b[15] = 0x16
	return keybase1.TLFID(hex.EncodeToString(b))
}

type fakeTLF struct {
	id       keybase1.TLFID
	revision int
}

func newFakeTLF() *fakeTLF {
	return &fakeTLF{
		id:       newTLFID(),
		revision: 0,
	}
}

type tlfUser struct {
	UID  keybase1.UID   `json:"uid"`
	Keys []keybase1.KID `json:"encryptKeys"`
}

type tlfUpdate struct {
	ID        keybase1.TLFID `json:"tlfid"`
	UID       keybase1.UID   `json:"uid"`
	KID       keybase1.KID   `json:"kid"`
	Revision  int            `json:"folderREvision"`
	Writers   []tlfUser      `json:"resolvedWriters"`
	Readers   []tlfUser      `json:"resolvedReaders"`
	IsPrivate bool           `json:"is_private"`
}

func (d *testDevice) keyNewTLF(uid keybase1.UID, writers []tlfUser, readers []tlfUser) *fakeTLF {
	ret := newFakeTLF()
	d.keyTLF(ret, uid, writers, readers)
	return ret
}

func (d *testDevice) keyTLF(tlf *fakeTLF, uid keybase1.UID, writers []tlfUser, readers []tlfUser) {
	tlf.revision++
	up := tlfUpdate{
		ID:        tlf.id,
		UID:       uid,
		KID:       d.KID(),
		Revision:  tlf.revision,
		Writers:   writers,
		Readers:   readers,
		IsPrivate: true,
	}
	g := d.tctx.G
	b, err := json.Marshal(up)
	if err != nil {
		d.t.Fatalf("error marshalling: %s", err)
	}
	apiArg := libkb.APIArg{
		Endpoint: "test/fake_generic_tlf",
		Args: libkb.HTTPArgs{
			"tlf_info": libkb.S{Val: string(b)},
		},
		SessionType: libkb.APISessionTypeREQUIRED,
	}
	_, err = g.API.Post(apiArg)
	if err != nil {
		d.t.Fatalf("post error: %s", err)
	}
}
