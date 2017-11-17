package engine

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type auditLog struct {
	l     logger.Logger
	lines *[]string
}

func newAuditLog(l logger.Logger) *auditLog {
	return &auditLog{l: l, lines: &[]string{}}
}

func (a *auditLog) GetLines() []string {
	return *a.lines
}

func (a *auditLog) ClearLines() {
	a.lines = &[]string{}
}

func (a *auditLog) Debug(format string, args ...interface{}) {
	s := fmt.Sprintf(format, args...)
	a.l.Debug(s)
	*a.lines = append(*a.lines, s)
}
func (a *auditLog) CDebugf(ctx context.Context, format string, args ...interface{}) {
	a.l.CDebugf(ctx, format, args...)
}
func (a *auditLog) Info(format string, args ...interface{}) {
	a.l.Info(format, args...)
}
func (a *auditLog) CInfof(ctx context.Context, format string, args ...interface{}) {
	a.l.CInfof(ctx, format, args...)
}
func (a *auditLog) Notice(format string, args ...interface{}) {
	a.l.Notice(format, args...)
}
func (a *auditLog) CNoticef(ctx context.Context, format string, args ...interface{}) {
	a.l.CNoticef(ctx, format, args...)
}
func (a *auditLog) Warning(format string, args ...interface{}) {
	a.l.Warning(format, args...)
}
func (a *auditLog) CWarningf(ctx context.Context, format string, args ...interface{}) {
	a.l.CWarningf(ctx, format, args...)
}
func (a *auditLog) Error(format string, args ...interface{}) {
	a.l.Errorf(format, args...)
}
func (a *auditLog) Errorf(format string, args ...interface{}) {
	a.l.Errorf(format, args...)
}
func (a *auditLog) CErrorf(ctx context.Context, format string, args ...interface{}) {
	a.l.CErrorf(ctx, format, args...)
}
func (a *auditLog) Critical(format string, args ...interface{}) {
	a.l.Critical(format, args...)
}
func (a *auditLog) CCriticalf(ctx context.Context, format string, args ...interface{}) {
	a.l.CCriticalf(ctx, format, args...)
}
func (a *auditLog) Fatalf(format string, args ...interface{}) {
	a.l.Fatalf(format, args...)
}
func (a *auditLog) CFatalf(ctx context.Context, format string, args ...interface{}) {
	a.l.CFatalf(ctx, format, args...)
}
func (a *auditLog) Profile(fmts string, args ...interface{}) {
	a.l.Profile(fmts, args...)
}
func (a *auditLog) Configure(style string, debug bool, filename string) {
	a.l.Configure(style, debug, filename)
}
func (a *auditLog) RotateLogFile() error {
	return a.l.RotateLogFile()
}
func (a *auditLog) CloneWithAddedDepth(depth int) logger.Logger {
	// Keep the same list of strings. This is important, because the tests here
	// read the list at the end, and expect all the log lines to be there, even
	// though some of the loggin calls in the middle call CloneWithAddedDepth.
	return &auditLog{
		l:     a.l.CloneWithAddedDepth(depth),
		lines: a.lines,
	}
}
func (a *auditLog) SetExternalHandler(handler logger.ExternalHandler) {
	a.l.SetExternalHandler(handler)
}

func corruptDevice2(dev1 libkb.TestContext, dev2 libkb.TestContext) (*libkb.DeviceKey, error) {
	ls1 := dev1.G.LoginState()
	ls2 := dev2.G.LoginState()

	err := ls1.RunSecretSyncer(dev1.G.Env.GetUID())
	if err != nil {
		return nil, err
	}
	var e2 error
	var ret libkb.DeviceKey

	err = ls1.SecretSyncer(func(s *libkb.SecretSyncer) {
		ret, e2 = s.FindDevice(dev1.G.Env.GetDeviceID())
	}, "corruptDevice2")
	if err != nil {
		return nil, err
	}
	if e2 != nil {
		return nil, e2
	}
	var goodLksec *libkb.LKSec

	// Dev1 has a passphrase cached, but dev2 doesn't (since it was provisioned).
	// For this test though it's fine to take the passphrase from dev1.
	err = ls1.PassphraseStreamCache(func(ppc *libkb.PassphraseStreamCache) {
		if !ppc.Valid() {
			e2 = errors.New("invalid stream cache")
			return
		}
		goodLksec = libkb.NewLKSec(ppc.PassphraseStream(), dev2.G.Env.GetUID(), dev2.G)
	}, "corruptDevice2")

	if err != nil {
		return nil, err
	}
	if e2 != nil {
		return nil, e2
	}
	if err = goodLksec.LoadServerHalf(nil); err != nil {
		return nil, err
	}

	dev1ServerHalf, err := ret.ToLKSec()
	if err != nil {
		return nil, err
	}

	badLskec := libkb.NewLKSecWithFullSecret(
		goodLksec.CorruptedFullSecretForBug3964Testing(dev1ServerHalf),
		dev2.G.Env.GetUID(),
		dev2.G,
	)

	err = ls2.MutateKeyring(func(krf *libkb.SKBKeyringFile) *libkb.SKBKeyringFile {
		for _, b := range krf.Blocks {
			raw, _, erroneousMask, err := goodLksec.Decrypt(nil, b.Priv.Data)
			if err != nil {
				e2 = err
				return nil
			}
			if !erroneousMask.IsNil() {
				e2 = errors.New("bad erroneousMask")
				return nil
			}
			b.Priv.Data, e2 = badLskec.Encrypt(raw)
			if e2 != nil {
				return nil
			}
		}
		krf.MarkDirty()
		if e2 = krf.Save(); e2 != nil {
			return nil
		}
		return krf
	}, "corruptDevice2")
	if err != nil {
		return nil, err
	}
	if e2 != nil {
		return nil, e2
	}
	return &ret, nil
}

// Limit the log lines to a function "trace" given by which. Meaning log lines
// that start with "+ which" and end with "- which"
func limitToTrace(lines []string, which string) []string {
	for i, l := range lines {
		if l == "+ "+which {
			rest := lines[(i + 1):]
			for j, k := range rest {
				if strings.HasPrefix(k, "- "+which) {
					return rest[:j]
				}
			}
			return nil
		}
	}
	return nil
}

func checkAuditLogForBug3964Recovery(t *testing.T, log []string, deviceID keybase1.DeviceID, dev1Key *libkb.DeviceKey) {
	log = limitToTrace(log, "LKSec#tryAllDevicesForBug3964Recovery()")
	needle := fmt.Sprintf("| Trying Bug 3964 Recovery w/ device %q {id: %s, lks: %s...}",
		dev1Key.Description, deviceID, dev1Key.LksServerHalf[0:8])
	for i, line := range log {
		if strings.HasPrefix(line, needle) {
			if log[i+1] == "| Success" {
				return
			}
			t.Fatalf("Found %q but it wasn't followed by '| Success'", needle)
		}
	}
	t.Fatalf("Didn't find evidence of %q", needle)
}

func findLine(t *testing.T, haystack []string, needle string) []string {
	for i, line := range haystack {
		if strings.HasPrefix(line, needle) {
			return haystack[(i + 1):]
		}
	}
	t.Fatalf("Didnt find line %q", needle)
	return nil
}

func checkAuditLogForBug3964Repair(t *testing.T, log []string, deviceID keybase1.DeviceID, dev1Key *libkb.DeviceKey) {
	log = limitToTrace(log, "bug3964Repairman#Run")
	if len(log) == 0 {
		t.Fatal("Didn't find a repairman run")
	}
	log = findLine(t, log, "| Repairman wasn't short-circuited")
	log = findLine(t, log, "+ bug3964Repairman#saveRepairmanVisit")
}

func logoutLogin(t *testing.T, user *FakeUser, dev libkb.TestContext) {
	Logout(dev)

	ctx := &Context{
		ProvisionUI: newTestProvisionUIPassphrase(),
		LoginUI:     &libkb.TestLoginUI{},
		LogUI:       dev.G.UI.GetLogUI(),
		SecretUI:    user.NewSecretUI(),
		GPGUI:       &gpgtestui{},
	}
	eng := NewLogin(dev.G, libkb.DeviceTypeDesktop, user.Username, keybase1.ClientType_CLI)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}

func checkAuditLogCleanLogin(t *testing.T, log []string) {
	if len(limitToTrace(log, "LKSec#Decrypt()")) == 0 {
		t.Fatalf("at least expected a login call")
	}
	for _, line := range log {
		if strings.HasPrefix(line, "+ LKSec#tryAllDevicesForBug3964Recovery()") {
			t.Fatalf("found attempt to try bug 3964 recovery after a full repair")
		}
	}
}

func checkAuditLogForRepairmanShortCircuit(t *testing.T, log []string) {
	for _, line := range log {
		if strings.HasPrefix(line, "| Repairman wasn't short-circuited") {
			t.Fatalf("short-circuit mechanism failed")
		}
	}
	found := false
	for _, line := range log {
		if strings.HasPrefix(line, "| Repairman already visited after file update; bailing out") {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("Didn't find a mention of short-circuiting")
	}
}

func checkLKSWorked(t *testing.T, tctx libkb.TestContext, u *FakeUser) {
	ctx := &Context{
		SecretUI: u.NewSecretUI(),
	}
	me, err := libkb.LoadMe(libkb.LoadUserArg{Contextified: libkb.NewContextified(tctx.G)})
	if err != nil {
		t.Fatal(err)
	}
	// need unlocked signing key
	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceEncryptionKeyType,
	}
	arg := ctx.SecretKeyPromptArg(ska, "tracking signature")
	encKey, err := tctx.G.Keyrings.GetSecretKeyWithPrompt(arg)
	if err != nil {
		t.Fatal(err)
	}
	if encKey == nil {
		t.Fatal("got back a nil decryption key")
	}
	_, clientHalf, err := fetchLKS(ctx, tctx.G, encKey)
	if err != nil {
		t.Fatal(err)
	}
	pps, err := tctx.G.LoginState().GetPassphraseStream(ctx.SecretUI)
	if err != nil {
		t.Fatal(err)
	}
	clientHalfExpected := pps.LksClientHalf()
	if !clientHalf.Equal(clientHalfExpected) {
		t.Fatal("got bad passphrase from LKS recovery")
	}
}

func TestBug3964Repairman(t *testing.T) {
	var log *auditLog

	user, dev1, dev2, cleanup := SetupTwoDevicesWithHook(t, "bug", func(tc *libkb.TestContext) {
		log = newAuditLog(tc.G.Log)
		tc.G.Log = log
	})
	defer cleanup()

	dev1Key, err := corruptDevice2(dev1, dev2)
	if err != nil {
		t.Fatal(err)
	}

	dev2.G.TestOptions.NoBug3964Repair = true
	logoutLogin(t, user, dev2)
	checkAuditLogForBug3964Recovery(t, log.GetLines(), dev1.G.Env.GetDeviceID(), dev1Key)
	dev2.G.TestOptions.NoBug3964Repair = false

	log.ClearLines()
	logoutLogin(t, user, dev2)
	checkAuditLogForBug3964Repair(t, log.GetLines(), dev1.G.Env.GetDeviceID(), dev1Key)

	log.ClearLines()
	logoutLogin(t, user, dev2)
	checkAuditLogCleanLogin(t, log.GetLines())
	checkAuditLogForRepairmanShortCircuit(t, log.GetLines())

	checkLKSWorked(t, dev2, user)
}
