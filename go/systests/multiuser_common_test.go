package systests

import (
	"context"
	"io"
	"testing"
	"time"

	client "github.com/keybase/client/go/client"
	libkb "github.com/keybase/client/go/libkb"
	logger "github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	service "github.com/keybase/client/go/service"
	clockwork "github.com/keybase/clockwork"
	rpc "github.com/keybase/go-framed-msgpack-rpc/rpc"
	contextOld "golang.org/x/net/context"
)

// Tests for systests with multiuser, multidevice situations.
// The abbreviation "smu" means "Systests Multi User".  So
// smuUser is a 'Systests Multi User User"'

type smuUser struct {
	ctx            *smuContext
	devices        []*smuDeviceWrapper
	backupKeys     []backupKey
	usernamePrefix string
	username       string
	userInfo       *signupInfo
	primary        *smuDeviceWrapper
}

type smuContext struct {
	t         *testing.T
	log       logger.Logger
	fakeClock clockwork.FakeClock
	users     map[string](*smuUser)
}

func newSMUContext(t *testing.T) *smuContext {
	ret := &smuContext{
		t:         t,
		users:     make(map[string](*smuUser)),
		fakeClock: clockwork.NewFakeClockAt(time.Now()),
	}
	return ret
}

func (smc *smuContext) cleanup() {
	for _, v := range smc.users {
		v.cleanup()
	}
}

func (u *smuUser) cleanup() {
	if u == nil {
		return
	}
	for _, d := range u.devices {
		d.tctx.Cleanup()
	}
}

// smuDeviceWrapper wraps a mock "device", meaning an independent running service and
// some connected clients.
type smuDeviceWrapper struct {
	ctx       *smuContext
	tctx      *libkb.TestContext
	clones    []*libkb.TestContext
	deviceKey keybase1.PublicKey
	stopCh    chan error
	service   *service.Service
	cli       rpc.GenericClient
	xp        rpc.Transporter
}

func (d *smuDeviceWrapper) KID() keybase1.KID {
	return d.deviceKey.KID
}

func (d *smuDeviceWrapper) startService(numClones int) {
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

func (d *smuDeviceWrapper) stop() error {
	return <-d.stopCh
}

type smuTerminalUI struct{}

func (t smuTerminalUI) ErrorWriter() io.Writer                                        { return nil }
func (t smuTerminalUI) Output(string) error                                           { return nil }
func (t smuTerminalUI) OutputDesc(libkb.OutputDescriptor, string) error               { return nil }
func (t smuTerminalUI) OutputWriter() io.Writer                                       { return nil }
func (t smuTerminalUI) Printf(fmt string, args ...interface{}) (int, error)           { return 0, nil }
func (t smuTerminalUI) Prompt(libkb.PromptDescriptor, string) (string, error)         { return "", nil }
func (t smuTerminalUI) PromptForConfirmation(prompt string) error                     { return nil }
func (t smuTerminalUI) PromptPassword(libkb.PromptDescriptor, string) (string, error) { return "", nil }
func (t smuTerminalUI) PromptYesNo(libkb.PromptDescriptor, string, libkb.PromptDefault) (bool, error) {
	return false, nil
}
func (t smuTerminalUI) Tablify(headings []string, rowfunc func() []string) { return }
func (t smuTerminalUI) TerminalSize() (width int, height int)              { return }

type smuSecretUI struct {
	u *smuUser
}

func (s smuSecretUI) GetPassphrase(p keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (res keybase1.GetPassphraseRes, err error) {
	if p.Type == keybase1.PassphraseType_PAPER_KEY {
		res.Passphrase = s.u.userInfo.displayedPaperKey
	} else {
		res.Passphrase = s.u.userInfo.passphrase
	}
	s.u.ctx.log.Debug("| GetPassphrase: %v -> %v", p, res)
	return res, err
}

func (s smuLoginUI) GetEmailOrUsername(contextOld.Context, int) (string, error) {
	return s.u.username, nil
}
func (s smuLoginUI) PromptRevokePaperKeys(contextOld.Context, keybase1.PromptRevokePaperKeysArg) (ret bool, err error) {
	return false, nil
}
func (s smuLoginUI) DisplayPaperKeyPhrase(contextOld.Context, keybase1.DisplayPaperKeyPhraseArg) error {
	return nil
}
func (s smuLoginUI) DisplayPrimaryPaperKey(contextOld.Context, keybase1.DisplayPrimaryPaperKeyArg) error {
	return nil
}

type smuLoginUI struct {
	u *smuUser
}

func (d *smuDeviceWrapper) popClone() *libkb.TestContext {
	if len(d.clones) == 0 {
		panic("ran out of cloned environments")
	}
	ret := d.clones[0]
	d.clones = d.clones[1:]
	ui := genericUI{
		g:          ret.G,
		TerminalUI: smuTerminalUI{},
	}
	ret.G.SetUI(&ui)
	return ret
}

func (smc *smuContext) setupDevice(u *smuUser) *smuDeviceWrapper {
	tctx := setupTest(smc.t, u.usernamePrefix)
	tctx.G.SetClock(smc.fakeClock)
	ret := &smuDeviceWrapper{ctx: smc, tctx: tctx}
	u.devices = append(u.devices, ret)
	if u.primary == nil {
		u.primary = ret
	}
	if smc.log == nil {
		smc.log = tctx.G.Log
	}
	return ret
}

func (smc *smuContext) installKeybaseForUser(usernamePrefix string, numClones int) *smuUser {
	user := &smuUser{ctx: smc, usernamePrefix: usernamePrefix}
	smc.users[usernamePrefix] = user
	smc.newDevice(user, numClones)
	return user
}

func (smc *smuContext) newDevice(u *smuUser, numClones int) *smuDeviceWrapper {
	ret := smc.setupDevice(u)
	ret.startService(numClones)
	ret.startClient()
	return ret
}

func (u *smuUser) primaryDevice() *smuDeviceWrapper {
	return u.primary
}

func (d *smuDeviceWrapper) userClient() keybase1.UserClient {
	return keybase1.UserClient{Cli: d.cli}
}

func (d *smuDeviceWrapper) rpcClient() rpc.GenericClient {
	return d.cli
}

func (d *smuDeviceWrapper) startClient() {
	var err error
	tctx := d.popClone()
	d.cli, d.xp, err = client.GetRPCClientWithContext(tctx.G)
	if err != nil {
		d.ctx.t.Fatal(err)
	}
}

func (d *smuDeviceWrapper) loadEncryptionKIDs() (devices []keybase1.KID, backups []backupKey) {
	keyMap := make(map[keybase1.KID]keybase1.PublicKey)
	keys, err := d.userClient().LoadMyPublicKeys(context.TODO(), 0)
	if err != nil {
		d.ctx.t.Fatalf("Failed to LoadMyPublicKeys: %s", err)
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

func (u *smuUser) signup() {
	ctx := u.ctx
	userInfo := randomUser(u.usernamePrefix)
	u.userInfo = userInfo
	dw := u.primaryDevice()
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
		ctx.t.Fatal(err)
	}
	ctx.t.Logf("signed up %s", userInfo.username)
	u.username = userInfo.username
	var backupKey backupKey
	devices, backups := dw.loadEncryptionKIDs()
	if len(devices) != 1 {
		ctx.t.Fatalf("Expected 1 device back; got %d", len(devices))
	}
	if len(backups) != 1 {
		ctx.t.Fatalf("Expected 1 backup back; got %d", len(backups))
	}
	dw.deviceKey.KID = devices[0]
	backupKey = backups[0]
	backupKey.secret = signupUI.info.displayedPaperKey
	u.backupKeys = append(u.backupKeys, backupKey)
}

type smuTeam struct {
	name string
}

func (u *smuUser) getTeamsClient() keybase1.TeamsClient {
	return keybase1.TeamsClient{Cli: u.primaryDevice().rpcClient()}
}

func (u *smuUser) pollForMembershipUpdate(team smuTeam, kg keybase1.PerTeamKeyGeneration) keybase1.TeamDetails {
	wait := 10 * time.Millisecond
	var totalWait time.Duration
	i := 0
	for {
		cli := u.getTeamsClient()
		details, err := cli.TeamGet(context.TODO(), keybase1.TeamGetArg{Name: team.name, ForceRepoll: true})
		if err != nil {
			u.ctx.t.Fatal(err)
		}
		if details.KeyGeneration == kg {
			u.ctx.log.Debug("found key generation 2")
			return details
		}
		if i == 9 {
			break
		}
		i++
		u.ctx.log.Debug("in pollForMembershipUpdate: iter=%d; missed it, now waiting for %s", i, wait)
		time.Sleep(wait)
		totalWait += wait
		wait = wait * 2
	}
	u.ctx.t.Fatalf("Failed to find the needed key generation (%d) after %s of waiting (%d iterations)", kg, totalWait, i)
	return keybase1.TeamDetails{}
}

func (u *smuUser) createTeam(writers []*smuUser) smuTeam {
	name := u.username + "t"
	cli := u.getTeamsClient()
	err := cli.TeamCreate(context.TODO(), keybase1.TeamCreateArg{Name: name})
	if err != nil {
		u.ctx.t.Fatal(err)
	}
	for _, w := range writers {
		err = cli.TeamAddMember(context.TODO(), keybase1.TeamAddMemberArg{
			Name:     name,
			Username: w.username,
			Role:     keybase1.TeamRole_WRITER,
		})
		if err != nil {
			u.ctx.t.Fatal(err)
		}
	}
	return smuTeam{name: name}
}

func (u *smuUser) addWriter(team smuTeam, w *smuUser) {
	cli := u.getTeamsClient()
	err := cli.TeamAddMember(context.TODO(), keybase1.TeamAddMemberArg{
		Name:     team.name,
		Username: w.username,
		Role:     keybase1.TeamRole_WRITER,
	})
	if err != nil {
		u.ctx.t.Fatal(err)
	}
}

func (u *smuUser) reset() {
	err := u.primaryDevice().userClient().ResetUser(context.TODO(), 0)
	if err != nil {
		u.ctx.t.Fatal(err)
	}
}

func (u *smuUser) getPrimaryGlobalContext() *libkb.GlobalContext {
	return u.primaryDevice().tctx.G
}

func (u *smuUser) loginAfterReset(numClones int) *smuDeviceWrapper {
	dev := u.ctx.newDevice(u, numClones)
	u.primary = dev
	g := dev.tctx.G
	ui := genericUI{
		g:           g,
		SecretUI:    smuSecretUI{u},
		LoginUI:     smuLoginUI{u},
		ProvisionUI: nullProvisionUI{randomDevice()},
	}
	g.SetUI(&ui)
	cmd := client.NewCmdLoginRunner(g)
	err := cmd.Run()
	if err != nil {
		u.ctx.t.Fatal(err)
	}
	return dev
}

func (u *smuUser) teamGet(team smuTeam) (keybase1.TeamDetails, error) {
	cli := u.getTeamsClient()
	details, err := cli.TeamGet(context.TODO(), keybase1.TeamGetArg{Name: team.name, ForceRepoll: true})
	return details, err
}
