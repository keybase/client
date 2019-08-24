package engine

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
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
	a.l.CloneWithAddedDepth(1).Debug(s)
	*a.lines = append(*a.lines, s)
}
func (a *auditLog) CDebugf(ctx context.Context, format string, args ...interface{}) {
	s := fmt.Sprintf(format, args...)
	a.l.CloneWithAddedDepth(1).CDebugf(ctx, s)
	*a.lines = append(*a.lines, s)
}
func (a *auditLog) Info(format string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).Info(format, args...)
}
func (a *auditLog) CInfof(ctx context.Context, format string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).CInfof(ctx, format, args...)
}
func (a *auditLog) Notice(format string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).Notice(format, args...)
}
func (a *auditLog) CNoticef(ctx context.Context, format string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).CNoticef(ctx, format, args...)
}
func (a *auditLog) Warning(format string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).Warning(format, args...)
}
func (a *auditLog) CWarningf(ctx context.Context, format string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).CWarningf(ctx, format, args...)
}
func (a *auditLog) Error(format string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).Errorf(format, args...)
}
func (a *auditLog) Errorf(format string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).Errorf(format, args...)
}
func (a *auditLog) CErrorf(ctx context.Context, format string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).CErrorf(ctx, format, args...)
}
func (a *auditLog) Critical(format string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).Critical(format, args...)
}
func (a *auditLog) CCriticalf(ctx context.Context, format string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).CCriticalf(ctx, format, args...)
}
func (a *auditLog) Fatalf(format string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).Fatalf(format, args...)
}
func (a *auditLog) CFatalf(ctx context.Context, format string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).CFatalf(ctx, format, args...)
}
func (a *auditLog) Profile(fmts string, args ...interface{}) {
	a.l.CloneWithAddedDepth(1).Profile(fmts, args...)
}
func (a *auditLog) Configure(style string, debug bool, filename string) {
	a.l.CloneWithAddedDepth(1).Configure(style, debug, filename)
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
	m2 := NewMetaContextForTest(dev2)
	m1 := NewMetaContextForTest(dev1)

	var ret libkb.DeviceKey

	ss, err := m1.G().ActiveDevice.SyncSecrets(m1)
	if err != nil {
		return nil, err
	}
	ret, err = ss.FindDevice(m1.G().Env.GetDeviceID())
	if err != nil {
		return nil, err
	}

	// Dev1 has a passphrase cached, but dev2 doesn't (since it was provisioned).
	// For this test though it's fine to take the passphrase from dev1.
	pps, err := libkb.GetPassphraseStreamStored(m1)
	if err != nil {
		return nil, err
	}
	if pps == nil {
		return nil, errors.New("empty passphrase stream on m1, but expected one since we just signed up")
	}
	goodLksec := libkb.NewLKSec(pps, m2.CurrentUID())

	if err = goodLksec.LoadServerHalf(m2); err != nil {
		return nil, err
	}

	dev1ServerHalf, err := ret.ToLKSec()
	if err != nil {
		return nil, err
	}

	badLskec := libkb.NewLKSecWithFullSecret(
		goodLksec.CorruptedFullSecretForBug3964Testing(dev1ServerHalf),
		dev2.G.Env.GetUID(),
	)
	var krf *libkb.SKBKeyringFile
	krf, err = libkb.LoadSKBKeyringFromMetaContext(m2)
	if err != nil {
		return nil, err
	}
	for _, b := range krf.Blocks {
		raw, _, erroneousMask, err := goodLksec.Decrypt(m2, b.Priv.Data)
		if err != nil {
			return nil, err
		}
		if !erroneousMask.IsNil() {
			return nil, errors.New("bad erroneousMask")
		}
		b.Priv.Data, err = badLskec.Encrypt(m2, raw)
		if err != nil {
			return nil, err
		}
	}
	krf.MarkDirty()
	if err = krf.Save(); err != nil {
		return nil, err
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
	t.Fatalf("Didn't find line %q", needle)
	return nil
}

func checkAuditLogForBug3964Repair(t *testing.T, log []string, deviceID keybase1.DeviceID, dev1Key *libkb.DeviceKey) {
	log = limitToTrace(log, "bug3964Repairman#Run")
	require.NotZero(t, len(log))
	log = findLine(t, log, "| Repairman wasn't short-circuited")
	require.NotZero(t, len(log))
	log = findLine(t, log, "+ bug3964Repairman#saveRepairmanVisit")
	require.NotZero(t, len(log))
}

func logoutLogin(t *testing.T, user *FakeUser, dev libkb.TestContext) {
	Logout(dev)

	uis := libkb.UIs{
		ProvisionUI: newTestProvisionUIPassphrase(),
		LoginUI:     &libkb.TestLoginUI{},
		LogUI:       dev.G.UI.GetLogUI(),
		SecretUI:    user.NewSecretUI(),
		GPGUI:       &gpgtestui{},
	}
	eng := NewLogin(dev.G, libkb.DeviceTypeDesktop, user.Username, keybase1.ClientType_CLI)
	m := NewMetaContextForTest(dev).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
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
	uis := libkb.UIs{
		SecretUI: u.NewSecretUI(),
	}
	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(NewMetaContextForTest(tctx)))
	if err != nil {
		t.Fatal(err)
	}
	// need unlocked signing key
	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceEncryptionKeyType,
	}
	m := NewMetaContextForTest(tctx).WithUIs(uis)
	arg := m.SecretKeyPromptArg(ska, "tracking signature")
	encKey, err := tctx.G.Keyrings.GetSecretKeyWithPrompt(NewMetaContextForTest(tctx), arg)
	if err != nil {
		t.Fatal(err)
	}
	if encKey == nil {
		t.Fatal("got back a nil decryption key")
	}
	_, clientHalf, err := fetchLKS(m, encKey)
	if err != nil {
		t.Fatal(err)
	}
	pps, err := libkb.GetPassphraseStreamStored(m)
	if err != nil {
		t.Fatal(err)
	}
	if pps == nil {
		t.Fatal("failed to get passphrase stream")
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

	t.Logf("-------------- Checkpoint 1 -----------------------")
	dev1Key, err := corruptDevice2(dev1, dev2)
	if err != nil {
		t.Fatal(err)
	}

	dev2.G.TestOptions.NoBug3964Repair = true
	logoutLogin(t, user, dev2)
	t.Logf("-------------- Checkpoint 2 -----------------------")
	checkAuditLogForBug3964Recovery(t, log.GetLines(), dev1.G.Env.GetDeviceID(), dev1Key)
	dev2.G.TestOptions.NoBug3964Repair = false

	log.ClearLines()
	logoutLogin(t, user, dev2)
	t.Logf("-------------- Checkpoint 3 -----------------------")
	checkAuditLogForBug3964Repair(t, log.GetLines(), dev1.G.Env.GetDeviceID(), dev1Key)

	log.ClearLines()
	logoutLogin(t, user, dev2)
	t.Logf("-------------- Checkpoint 4 -----------------------")
	checkAuditLogCleanLogin(t, log.GetLines())
	checkAuditLogForRepairmanShortCircuit(t, log.GetLines())

	t.Logf("-------------- Checkpoint 5 -----------------------")
	checkLKSWorked(t, dev2, user)
}
