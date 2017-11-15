package systests

import (
	"context"
	"io"
	"testing"
	"time"

	client "github.com/keybase/client/go/client"
	engine "github.com/keybase/client/go/engine"
	libkb "github.com/keybase/client/go/libkb"
	logger "github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	service "github.com/keybase/client/go/service"
	teams "github.com/keybase/client/go/teams"
	clockwork "github.com/keybase/clockwork"
	rpc "github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
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

func (d *smuDeviceWrapper) clearUPAKCache() {
	d.tctx.G.LocalDb.Nuke()
	d.tctx.G.GetUPAKLoader().ClearMemory()
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

type signupInfoSecretUI struct {
	signupInfo *signupInfo
	log        logger.Logger
}

func (s signupInfoSecretUI) GetPassphrase(p keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (res keybase1.GetPassphraseRes, err error) {
	if p.Type == keybase1.PassphraseType_PAPER_KEY {
		res.Passphrase = s.signupInfo.displayedPaperKey
	} else {
		res.Passphrase = s.signupInfo.passphrase
	}
	s.log.Debug("| GetPassphrase: %v -> %v", p, res)
	return res, err
}

type usernameLoginUI struct {
	username string
}

func (s usernameLoginUI) GetEmailOrUsername(contextOld.Context, int) (string, error) {
	return s.username, nil
}
func (s usernameLoginUI) PromptRevokePaperKeys(contextOld.Context, keybase1.PromptRevokePaperKeysArg) (ret bool, err error) {
	return false, nil
}
func (s usernameLoginUI) DisplayPaperKeyPhrase(contextOld.Context, keybase1.DisplayPaperKeyPhraseArg) error {
	return nil
}
func (s usernameLoginUI) DisplayPrimaryPaperKey(contextOld.Context, keybase1.DisplayPrimaryPaperKeyArg) error {
	return nil
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
	return smc.setupDeviceHelper(u, true)
}

func (smc *smuContext) setupDeviceNoPUK(u *smuUser) *smuDeviceWrapper {
	return smc.setupDeviceHelper(u, false)
}

func (smc *smuContext) setupDeviceHelper(u *smuUser, puk bool) *smuDeviceWrapper {
	tctx := setupTest(smc.t, u.usernamePrefix)
	tctx.Tp.DisableUpgradePerUserKey = !puk
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

func (smc *smuContext) installKeybaseForUserNoPUK(usernamePrefix string, numClones int) *smuUser {
	user := &smuUser{ctx: smc, usernamePrefix: usernamePrefix}
	smc.users[usernamePrefix] = user
	smc.newDevice(user, numClones)
	return user
}

func (smc *smuContext) newDevice(u *smuUser, numClones int) *smuDeviceWrapper {
	return smc.newDeviceHelper(u, numClones, true)
}

func (smc *smuContext) newDeviceNoPUK(u *smuUser, numClones int) *smuDeviceWrapper {
	return smc.newDeviceHelper(u, numClones, false)
}

func (smc *smuContext) newDeviceHelper(u *smuUser, numClones int, puk bool) *smuDeviceWrapper {
	ret := smc.setupDeviceHelper(u, puk)
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
	u.signupHelper(true)
}

func (u *smuUser) signupNoPUK() {
	u.signupHelper(false)
}

func (u *smuUser) signupHelper(puk bool) {
	ctx := u.ctx
	userInfo := randomUser(u.usernamePrefix)
	u.userInfo = userInfo
	dw := u.primaryDevice()
	tctx := dw.popClone()
	tctx.Tp.DisableUpgradePerUserKey = !puk
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

	// Reconfigure config subsystem in Primary Global Context and also
	// in all clones. This has to be done after signup because the
	// username changes, and so does config filename.
	dw.tctx.G.ConfigureConfig()
	for _, clone := range dw.clones {
		clone.G.ConfigureConfig()
	}
}

func (u *smuUser) perUserKeyUpgrade() error {
	g := u.getPrimaryGlobalContext()
	arg := &engine.PerUserKeyUpgradeArgs{}
	eng := engine.NewPerUserKeyUpgrade(g, arg)
	ctx := &engine.Context{
		LogUI: g.UI.GetLogUI(),
	}
	err := engine.RunEngine(eng, ctx)
	return err
}

type smuTeam struct {
	name string
}

type smuImplicitTeam struct {
	ID keybase1.TeamID
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
			u.ctx.log.Debug("found key generation %d", kg)
			return details
		}
		if i == 9 {
			break
		}
		i++
		u.ctx.log.Debug("in pollForMembershipUpdate: iter=%d; missed it, now waiting for %s (latest details.KG = %d)", i, wait, details.KeyGeneration)
		time.Sleep(wait)
		totalWait += wait
		wait = wait * 2
	}
	u.ctx.t.Fatalf("Failed to find the needed key generation (%d) after %s of waiting (%d iterations)", kg, totalWait, i)
	return keybase1.TeamDetails{}
}

func (u *smuUser) pollForTeamSeqnoLink(team smuTeam, toSeqno keybase1.Seqno) {
	for i := 0; i < 20; i++ {
		details, err := teams.Load(context.TODO(), u.getPrimaryGlobalContext(), keybase1.LoadTeamArg{
			Name:        team.name,
			ForceRepoll: true,
		})
		if err != nil {
			u.ctx.t.Fatalf("error while loading team %q: %v", team.name, err)
		}

		if details.CurrentSeqno() >= toSeqno {
			u.ctx.t.Logf("Found new seqno %d at poll loop iter %d", details.CurrentSeqno(), i)
			return
		}

		time.Sleep(500 * time.Millisecond)
	}

	u.ctx.t.Fatalf("timed out waiting for team rotate %s", team)
}

func (u *smuUser) createTeam(writers []*smuUser) smuTeam {
	name := u.username + "t"
	nameK1, err := keybase1.TeamNameFromString(name)
	if err != nil {
		u.ctx.t.Fatal(err)
	}
	cli := u.getTeamsClient()
	_, err = cli.TeamCreate(context.TODO(), keybase1.TeamCreateArg{Name: nameK1.String()})
	if err != nil {
		u.ctx.t.Fatal(err)
	}
	for _, w := range writers {
		_, err = cli.TeamAddMember(context.TODO(), keybase1.TeamAddMemberArg{
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

func (u *smuUser) lookupImplicitTeam(create bool, displayName string, public bool) smuImplicitTeam {
	cli := u.getTeamsClient()
	var err error
	var res keybase1.LookupImplicitTeamRes
	if create {
		res, err = cli.LookupOrCreateImplicitTeam(context.TODO(), keybase1.LookupOrCreateImplicitTeamArg{Name: displayName, Public: public})
	} else {
		res, err = cli.LookupImplicitTeam(context.TODO(), keybase1.LookupImplicitTeamArg{Name: displayName, Public: public})
	}
	if err != nil {
		u.ctx.t.Fatal(err)
	}
	return smuImplicitTeam{ID: res.TeamID}
}

func (u *smuUser) addTeamMember(team smuTeam, member *smuUser, role keybase1.TeamRole) {
	cli := u.getTeamsClient()
	_, err := cli.TeamAddMember(context.TODO(), keybase1.TeamAddMemberArg{
		Name:     team.name,
		Username: member.username,
		Role:     role,
	})
	if err != nil {
		u.ctx.t.Fatal(err)
	}
}

func (u *smuUser) addWriter(team smuTeam, w *smuUser) {
	u.addTeamMember(team, w, keybase1.TeamRole_WRITER)
}

func (u *smuUser) addAdmin(team smuTeam, w *smuUser) {
	u.addTeamMember(team, w, keybase1.TeamRole_ADMIN)
}

func (u *smuUser) addOwner(team smuTeam, w *smuUser) {
	u.addTeamMember(team, w, keybase1.TeamRole_OWNER)
}

func (u *smuUser) reAddUserAfterReset(team smuImplicitTeam, w *smuUser) {
	cli := u.getTeamsClient()
	err := cli.TeamReAddMemberAfterReset(context.TODO(), keybase1.TeamReAddMemberAfterResetArg{
		Id:       team.ID,
		Username: w.username,
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

func (u *smuUser) delete() {
	err := u.primaryDevice().userClient().DeleteUser(context.TODO(), 0)
	if err != nil {
		u.ctx.t.Fatal(err)
	}
}

func (u *smuUser) getPrimaryGlobalContext() *libkb.GlobalContext {
	return u.primaryDevice().tctx.G
}

func (u *smuUser) loginAfterReset(numClones int) *smuDeviceWrapper {
	return u.loginAfterResetHelper(numClones, true)
}

func (u *smuUser) loginAfterResetNoPUK(numClones int) *smuDeviceWrapper {
	return u.loginAfterResetHelper(numClones, false)
}

func (u *smuUser) loginAfterResetHelper(numClones int, puk bool) *smuDeviceWrapper {
	dev := u.ctx.newDeviceHelper(u, numClones, puk)
	u.primary = dev
	g := dev.tctx.G
	ui := genericUI{
		g:           g,
		SecretUI:    u.secretUI(),
		LoginUI:     usernameLoginUI{u.userInfo.username},
		ProvisionUI: nullProvisionUI{randomDevice()},
	}
	g.SetUI(&ui)
	cmd := client.NewCmdLoginRunner(g)
	err := cmd.Run()
	require.NoError(u.ctx.t, err, "login after reset")
	return dev
}

func (u *smuUser) secretUI() signupInfoSecretUI {
	return signupInfoSecretUI{u.userInfo, u.ctx.log}
}

func (u *smuUser) teamGet(team smuTeam) (keybase1.TeamDetails, error) {
	cli := u.getTeamsClient()
	details, err := cli.TeamGet(context.TODO(), keybase1.TeamGetArg{Name: team.name, ForceRepoll: true})
	return details, err
}

func (u *smuUser) teamMemberDetails(team smuTeam, user *smuUser) ([]keybase1.TeamMemberDetails, error) {
	teamDetails, err := u.teamGet(team)
	if err != nil {
		return nil, err
	}
	var all []keybase1.TeamMemberDetails
	all = append(all, teamDetails.Members.Owners...)
	all = append(all, teamDetails.Members.Admins...)
	all = append(all, teamDetails.Members.Writers...)
	all = append(all, teamDetails.Members.Readers...)

	var matches []keybase1.TeamMemberDetails
	for _, m := range all {
		if m.Username == user.username {
			matches = append(matches, m)
		}
	}
	if len(matches) == 0 {
		return nil, libkb.NotFoundError{}
	}
	return matches, nil
}

func (u *smuUser) isMemberActive(team smuTeam, user *smuUser) (bool, error) {
	details, err := u.teamMemberDetails(team, user)
	u.ctx.t.Logf("isMemberActive team member details for %s: %+v", user.username, details)
	if err != nil {
		return false, err
	}
	for _, d := range details {
		if d.Active {
			return true, nil
		}
	}
	return false, nil
}

func (u *smuUser) assertMemberActive(team smuTeam, user *smuUser) {
	active, err := u.isMemberActive(team, user)
	if err != nil {
		u.ctx.t.Fatalf("assertMemberActive error: %s", err)
	}
	if !active {
		u.ctx.t.Errorf("user %s not active (expected active)", user.username)
	}
}

func (u *smuUser) assertMemberInactive(team smuTeam, user *smuUser) {
	active, err := u.isMemberActive(team, user)
	if err != nil {
		u.ctx.t.Fatalf("assertMemberInactive error: %s", err)
	}
	if active {
		u.ctx.t.Errorf("user %s is active (expected inactive)", user.username)
	}
}

func (u *smuUser) uid() keybase1.UID {
	return u.primaryDevice().tctx.G.Env.GetUID()
}

func (u *smuUser) openTeam(team smuTeam, role keybase1.TeamRole) {
	cli := u.getTeamsClient()
	err := cli.TeamSetSettings(context.Background(), keybase1.TeamSetSettingsArg{
		Name: team.name,
		Settings: keybase1.TeamSettings{
			Open:   true,
			JoinAs: role,
		},
	})
	if err != nil {
		u.ctx.t.Fatal(err)
	}
}

func (u *smuUser) requestAccess(team smuTeam) {
	cli := u.getTeamsClient()
	_, err := cli.TeamRequestAccess(context.Background(), keybase1.TeamRequestAccessArg{
		Name: team.name,
	})
	if err != nil {
		u.ctx.t.Fatal(err)
	}
}
