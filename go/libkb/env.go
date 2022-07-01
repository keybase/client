// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	logger "github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/systemd"
	"github.com/syndtr/goleveldb/leveldb/opt"
)

type NullConfiguration struct{}

func (n NullConfiguration) GetHome() string                                                { return "" }
func (n NullConfiguration) GetMobileSharedHome() string                                    { return "" }
func (n NullConfiguration) GetServerURI() (string, error)                                  { return "", nil }
func (n NullConfiguration) GetConfigFilename() string                                      { return "" }
func (n NullConfiguration) GetUpdaterConfigFilename() string                               { return "" }
func (n NullConfiguration) GetGUIConfigFilename() string                                   { return "" }
func (n NullConfiguration) GetDeviceCloneStateFilename() string                            { return "" }
func (n NullConfiguration) GetSessionFilename() string                                     { return "" }
func (n NullConfiguration) GetDbFilename() string                                          { return "" }
func (n NullConfiguration) GetChatDbFilename() string                                      { return "" }
func (n NullConfiguration) GetPvlKitFilename() string                                      { return "" }
func (n NullConfiguration) GetParamProofKitFilename() string                               { return "" }
func (n NullConfiguration) GetExternalURLKitFilename() string                              { return "" }
func (n NullConfiguration) GetProveBypass() (bool, bool)                                   { return false, false }
func (n NullConfiguration) GetUsername() NormalizedUsername                                { return NormalizedUsername("") }
func (n NullConfiguration) GetEmail() string                                               { return "" }
func (n NullConfiguration) GetProxy() string                                               { return "" }
func (n NullConfiguration) GetProxyType() string                                           { return "" }
func (n NullConfiguration) IsCertPinningEnabled() bool                                     { return true }
func (n NullConfiguration) GetGpgHome() string                                             { return "" }
func (n NullConfiguration) GetBundledCA(h string) string                                   { return "" }
func (n NullConfiguration) GetUserCacheMaxAge() (time.Duration, bool)                      { return 0, false }
func (n NullConfiguration) GetProofCacheSize() (int, bool)                                 { return 0, false }
func (n NullConfiguration) GetProofCacheLongDur() (time.Duration, bool)                    { return 0, false }
func (n NullConfiguration) GetProofCacheMediumDur() (time.Duration, bool)                  { return 0, false }
func (n NullConfiguration) GetProofCacheShortDur() (time.Duration, bool)                   { return 0, false }
func (n NullConfiguration) GetLinkCacheSize() (int, bool)                                  { return 0, false }
func (n NullConfiguration) GetLinkCacheCleanDur() (time.Duration, bool)                    { return 0, false }
func (n NullConfiguration) GetUPAKCacheSize() (int, bool)                                  { return 0, false }
func (n NullConfiguration) GetUIDMapFullNameCacheSize() (int, bool)                        { return 0, false }
func (n NullConfiguration) GetPayloadCacheSize() (int, bool)                               { return 0, false }
func (n NullConfiguration) GetMerkleKIDs() []string                                        { return nil }
func (n NullConfiguration) GetCodeSigningKIDs() []string                                   { return nil }
func (n NullConfiguration) GetPinentry() string                                            { return "" }
func (n NullConfiguration) GetUID() (ret keybase1.UID)                                     { return }
func (n NullConfiguration) GetGpg() string                                                 { return "" }
func (n NullConfiguration) GetGpgOptions() []string                                        { return nil }
func (n NullConfiguration) GetPGPFingerprint() *PGPFingerprint                             { return nil }
func (n NullConfiguration) GetSecretKeyringTemplate() string                               { return "" }
func (n NullConfiguration) GetSalt() []byte                                                { return nil }
func (n NullConfiguration) GetSocketFile() string                                          { return "" }
func (n NullConfiguration) GetPidFile() string                                             { return "" }
func (n NullConfiguration) GetStandalone() (bool, bool)                                    { return false, false }
func (n NullConfiguration) GetLocalRPCDebug() string                                       { return "" }
func (n NullConfiguration) GetTimers() string                                              { return "" }
func (n NullConfiguration) GetDeviceID() keybase1.DeviceID                                 { return "" }
func (n NullConfiguration) GetDeviceIDForUsername(un NormalizedUsername) keybase1.DeviceID { return "" }
func (n NullConfiguration) GetDeviceIDForUID(u keybase1.UID) keybase1.DeviceID             { return "" }
func (n NullConfiguration) GetProxyCACerts() ([]string, error)                             { return nil, nil }
func (n NullConfiguration) GetUsernameForUID(u keybase1.UID) NormalizedUsername {
	return NormalizedUsername("")
}
func (n NullConfiguration) GetUIDForUsername(u NormalizedUsername) keybase1.UID {
	return keybase1.UID("")
}
func (n NullConfiguration) GetStayLoggedOut() (bool, bool)                  { return false, false }
func (n NullConfiguration) GetAutoFork() (bool, bool)                       { return false, false }
func (n NullConfiguration) GetRunMode() (RunMode, error)                    { return NoRunMode, nil }
func (n NullConfiguration) GetNoAutoFork() (bool, bool)                     { return false, false }
func (n NullConfiguration) GetLogFile() string                              { return "" }
func (n NullConfiguration) GetEKLogFile() string                            { return "" }
func (n NullConfiguration) GetPerfLogFile() string                          { return "" }
func (n NullConfiguration) GetGUILogFile() string                           { return "" }
func (n NullConfiguration) GetUseDefaultLogFile() (bool, bool)              { return false, false }
func (n NullConfiguration) GetUseRootConfigFile() (bool, bool)              { return false, false }
func (n NullConfiguration) GetLogPrefix() string                            { return "" }
func (n NullConfiguration) GetScraperTimeout() (time.Duration, bool)        { return 0, false }
func (n NullConfiguration) GetAPITimeout() (time.Duration, bool)            { return 0, false }
func (n NullConfiguration) GetTorMode() (TorMode, error)                    { return TorNone, nil }
func (n NullConfiguration) GetTorHiddenAddress() string                     { return "" }
func (n NullConfiguration) GetTorProxy() string                             { return "" }
func (n NullConfiguration) GetUpdatePreferenceAuto() (bool, bool)           { return false, false }
func (n NullConfiguration) GetUpdatePreferenceSnoozeUntil() keybase1.Time   { return keybase1.Time(0) }
func (n NullConfiguration) GetUpdateLastChecked() keybase1.Time             { return keybase1.Time(0) }
func (n NullConfiguration) GetUpdatePreferenceSkip() string                 { return "" }
func (n NullConfiguration) GetUpdateURL() string                            { return "" }
func (n NullConfiguration) GetUpdateDisabled() (bool, bool)                 { return false, false }
func (n NullConfiguration) GetVDebugSetting() string                        { return "" }
func (n NullConfiguration) GetLocalTrackMaxAge() (time.Duration, bool)      { return 0, false }
func (n NullConfiguration) GetGregorURI() string                            { return "" }
func (n NullConfiguration) GetGregorSaveInterval() (time.Duration, bool)    { return 0, false }
func (n NullConfiguration) GetGregorPingInterval() (time.Duration, bool)    { return 0, false }
func (n NullConfiguration) GetGregorPingTimeout() (time.Duration, bool)     { return 0, false }
func (n NullConfiguration) GetChatDelivererInterval() (time.Duration, bool) { return 0, false }
func (n NullConfiguration) GetGregorDisabled() (bool, bool)                 { return false, false }
func (n NullConfiguration) GetSecretStorePrimingDisabled() (bool, bool)     { return false, false }
func (n NullConfiguration) GetMountDir() string                             { return "" }
func (n NullConfiguration) GetMountDirDefault() string                      { return "" }
func (n NullConfiguration) GetBGIdentifierDisabled() (bool, bool)           { return false, false }
func (n NullConfiguration) GetFeatureFlags() (FeatureFlags, error)          { return FeatureFlags{}, nil }
func (n NullConfiguration) GetAppType() AppType                             { return NoAppType }
func (n NullConfiguration) IsMobileExtension() (bool, bool)                 { return false, false }
func (n NullConfiguration) GetSlowGregorConn() (bool, bool)                 { return false, false }
func (n NullConfiguration) GetReadDeletedSigChain() (bool, bool)            { return false, false }
func (n NullConfiguration) GetRememberPassphrase(NormalizedUsername) (bool, bool) {
	return false, false
}
func (n NullConfiguration) GetLevelDBNumFiles() (int, bool)                { return 0, false }
func (n NullConfiguration) GetLevelDBWriteBufferMB() (int, bool)           { return 4, false }
func (n NullConfiguration) GetChatInboxSourceLocalizeThreads() (int, bool) { return 1, false }
func (n NullConfiguration) GetAttachmentHTTPStartPort() (int, bool)        { return 0, false }
func (n NullConfiguration) GetAttachmentDisableMulti() (bool, bool)        { return false, false }
func (n NullConfiguration) GetDisableTeamAuditor() (bool, bool)            { return false, false }
func (n NullConfiguration) GetDisableMerkleAuditor() (bool, bool)          { return false, false }
func (n NullConfiguration) GetDisableSearchIndexer() (bool, bool)          { return false, false }
func (n NullConfiguration) GetDisableBgConvLoader() (bool, bool)           { return false, false }
func (n NullConfiguration) GetDisableTeamBoxAuditor() (bool, bool)         { return false, false }
func (n NullConfiguration) GetDisableEKBackgroundKeygen() (bool, bool)     { return false, false }
func (n NullConfiguration) GetEnableBotLiteMode() (bool, bool)             { return false, false }
func (n NullConfiguration) GetExtraNetLogging() (bool, bool)               { return false, false }
func (n NullConfiguration) GetForceLinuxKeyring() (bool, bool)             { return false, false }
func (n NullConfiguration) GetForceSecretStoreFile() (bool, bool)          { return false, false }
func (n NullConfiguration) GetRuntimeStatsEnabled() (bool, bool)           { return false, false }
func (n NullConfiguration) GetPassphraseState() *keybase1.PassphraseState  { return nil }
func (n NullConfiguration) GetPassphraseStateForUsername(NormalizedUsername) *keybase1.PassphraseState {
	return nil
}

func (n NullConfiguration) GetBug3964RepairTime(NormalizedUsername) (time.Time, error) {
	return time.Time{}, nil
}
func (n NullConfiguration) GetUserConfig() (*UserConfig, error) { return nil, nil }
func (n NullConfiguration) GetUserConfigForUsername(s NormalizedUsername) (*UserConfig, error) {
	return nil, nil
}
func (n NullConfiguration) GetGString(string) string          { return "" }
func (n NullConfiguration) GetString(string) string           { return "" }
func (n NullConfiguration) GetBool(string, bool) (bool, bool) { return false, false }

func (n NullConfiguration) GetAllUsernames() (NormalizedUsername, []NormalizedUsername, error) {
	return NormalizedUsername(""), nil, nil
}
func (n NullConfiguration) GetAllUserConfigs() (*UserConfig, []UserConfig, error) {
	return nil, nil, nil
}

func (n NullConfiguration) GetDebug() (bool, bool)            { return false, false }
func (n NullConfiguration) GetDebugJourneycard() (bool, bool) { return false, false }
func (n NullConfiguration) GetDisplayRawUntrustedOutput() (bool, bool) {
	return false, false
}
func (n NullConfiguration) GetLogFormat() string {
	return ""
}
func (n NullConfiguration) GetAPIDump() (bool, bool) {
	return false, false
}
func (n NullConfiguration) GetNoPinentry() (bool, bool) {
	return false, false
}

func (n NullConfiguration) GetStringAtPath(string) (string, bool) {
	return "", false
}
func (n NullConfiguration) GetInterfaceAtPath(string) (interface{}, error) {
	return nil, nil
}

func (n NullConfiguration) GetBoolAtPath(string) (bool, bool) {
	return false, false
}

func (n NullConfiguration) GetIntAtPath(string) (int, bool) {
	return 0, false
}

func (n NullConfiguration) GetFloatAtPath(string) (float64, bool) {
	return 0, false
}

func (n NullConfiguration) GetNullAtPath(string) bool {
	return false
}

func (n NullConfiguration) GetSecurityAccessGroupOverride() (bool, bool) {
	return false, false
}

func (n NullConfiguration) GetAndroidInstallReferrerChecked() bool { return false }

type TestParameters struct {
	ConfigFilename   string
	Home             string
	MobileSharedHome string
	GPG              string
	GPGHome          string
	GPGOptions       []string
	Debug            bool
	// Whether we are in Devel Mode
	Devel bool
	// If we're in dev mode, the name for this test, with a random
	// suffix.
	DevelName                string
	DevelPrefix              string // when in test - name for the test without suffix.
	RuntimeDir               string
	DisableUpgradePerUserKey bool
	EnvironmentFeatureFlags  FeatureFlags

	// set to true to use production run mode in tests
	UseProductionRunMode bool

	// whether LogoutIfRevoked check should be skipped to avoid races
	// during resets.
	SkipLogoutIfRevokedCheck bool

	// On if, in test, we want to skip sending system chat messages
	SkipSendingSystemChatMessages bool

	// If we need to use the real clock for NIST generation (as in really
	// whacky tests liks TestRekey).
	UseTimeClockForNISTs bool

	// TeamNoHeadMerkleStore is used for testing to emulate older clients
	// that didn't store the head merkle sequence to team chain state. We
	// have an upgrade path in the code that we'd like to test.
	TeamNoHeadMerkleStore bool

	// TeamSkipAudit is on because some team chains are "canned" and therefore
	// might point off of the merkle sequence in the database. So it's just
	// easiest to skip the audit in those cases.
	TeamSkipAudit bool

	// NoGregor is on if we want to test the service without any gregor conection
	NoGregor bool

	// TeamAuditParams can be customized if we want to control the behavior
	// of audits deep in a test
	TeamAuditParams *TeamAuditParams

	// Toggle if we want to try to 'prime' the secret store before using it.
	SecretStorePrimingDisabled bool

	// Extra headers for API
	APIHeaders map[string]string
}

func (tp TestParameters) GetDebug() (bool, bool) {
	if tp.Debug {
		return true, true
	}
	return false, false
}

func (tp TestParameters) GetNoGregor() (bool, bool) {
	if tp.NoGregor {
		return true, true
	}
	return false, false
}

func (tp TestParameters) GetSecretStorePrimingDisabled() (bool, bool) {
	if tp.SecretStorePrimingDisabled {
		return true, true
	}
	return false, false
}

type Env struct {
	sync.RWMutex
	cmd           CommandLine
	config        ConfigReader
	HomeFinder    HomeFinder
	writer        ConfigWriter
	Test          *TestParameters
	updaterConfig UpdaterConfigReader
	guiConfig     *JSONFile
}

func (e *Env) GetConfig() ConfigReader {
	e.RLock()
	defer e.RUnlock()
	return e.config
}

func (e *Env) GetConfigWriter() ConfigWriter {
	e.RLock()
	defer e.RUnlock()
	return e.writer
}

func (e *Env) SetCommandLine(cmd CommandLine) {
	e.Lock()
	defer e.Unlock()
	e.cmd = cmd
}

func (e *Env) GetCommandLine() CommandLine {
	e.RLock()
	defer e.RUnlock()
	return e.cmd
}

func (e *Env) SetConfig(r ConfigReader, w ConfigWriter) {
	e.Lock()
	defer e.Unlock()
	e.config = r
	e.writer = w
}

func (e *Env) SetGUIConfig(j *JSONFile) {
	e.Lock()
	defer e.Unlock()
	e.guiConfig = j
}

func (e *Env) GetGUIConfig() *JSONFile {
	e.RLock()
	defer e.RUnlock()
	return e.guiConfig
}

func (e *Env) SetUpdaterConfig(r UpdaterConfigReader) {
	e.Lock()
	defer e.Unlock()
	e.updaterConfig = r
}

func (e *Env) GetUpdaterConfig() UpdaterConfigReader {
	e.RLock()
	defer e.RUnlock()
	return e.updaterConfig
}

func (e *Env) GetOldMountDirDefault() string {
	switch RuntimeGroup() {
	case keybase1.RuntimeGroup_LINUXLIKE:
		return filepath.Join(e.GetDataDir(), "fs")
	default:
		return e.GetMountDirDefault()
	}
}

func (e *Env) GetMountDirDefault() string {
	switch RuntimeGroup() {
	case keybase1.RuntimeGroup_DARWINLIKE:
		volumes := "/Volumes"
		user, err := user.Current()
		var username string
		if err != nil {
			// The iOS simulator may not have a proper user set,
			username = "<unknown>"
		} else {
			username = user.Username
		}
		var runmodeName string
		switch e.GetRunMode() {
		case DevelRunMode:
			runmodeName = "KeybaseDevel"
		case StagingRunMode:
			runmodeName = "KeybaseStaging"
		case ProductionRunMode:
			runmodeName = "Keybase"
		default:
			panic("Invalid run mode")
		}
		return filepath.Join(volumes, fmt.Sprintf(
			"%s (%s)", runmodeName, username))
	case keybase1.RuntimeGroup_LINUXLIKE:
		return filepath.Join(e.GetRuntimeDir(), "kbfs")
	// kbfsdokan depends on an empty default
	case keybase1.RuntimeGroup_WINDOWSLIKE:
		return ""
	default:
		return filepath.Join(e.GetRuntimeDir(), "kbfs")
	}
}

func (e *Env) GetMountDir() (string, error) {
	return e.GetString(
		func() string { return e.cmd.GetMountDir() },
		func() string { return os.Getenv("KEYBASE_MOUNTDIR") },
		func() string { return e.GetConfig().GetMountDir() },
		e.GetMountDirDefault,
	), nil
}

func NewEnv(cmd CommandLine, config ConfigReader, getLog LogGetter) *Env {
	return newEnv(cmd, config, runtime.GOOS, getLog)
}

func newEnv(cmd CommandLine, config ConfigReader, osname string, getLog LogGetter) *Env {
	if cmd == nil {
		cmd = NullConfiguration{}
	}
	if config == nil {
		config = NullConfiguration{}
	}
	e := Env{cmd: cmd, config: config, Test: &TestParameters{}}

	e.HomeFinder = NewHomeFinder("keybase",
		e.getHomeFromTestOrCmd,
		func() string { return e.GetConfig().GetHome() },
		e.getMobileSharedHomeFromCmdOrConfig,
		osname,
		e.GetRunMode,
		getLog,
		os.Getenv)
	return &e
}

func (e *Env) getHomeFromTestOrCmd() string {
	return e.GetString(
		func() string { return e.Test.Home },
		func() string {
			home := e.cmd.GetHome()
			if home == "" {
				return ""
			}
			absHome, err := filepath.Abs(home)
			if err != nil {
				return home
			}
			return absHome
		},
	)
}

func (e *Env) getMobileSharedHomeFromCmdOrConfig() string {
	return e.GetString(
		func() string { return e.Test.MobileSharedHome },
		func() string { return e.cmd.GetMobileSharedHome() },
		func() string { return e.GetConfig().GetMobileSharedHome() },
	)
}

func (e *Env) GetDownloadsDir() string     { return e.HomeFinder.DownloadsDir() }
func (e *Env) GetHome() string             { return e.HomeFinder.Home(false) }
func (e *Env) GetMobileSharedHome() string { return e.HomeFinder.MobileSharedHome(false) }
func (e *Env) GetConfigDir() string        { return e.HomeFinder.ConfigDir() }
func (e *Env) GetCacheDir() string         { return e.HomeFinder.CacheDir() }
func (e *Env) GetSharedCacheDir() string   { return e.HomeFinder.SharedCacheDir() }
func (e *Env) GetSandboxCacheDir() string  { return e.HomeFinder.SandboxCacheDir() }
func (e *Env) GetDataDir() string          { return e.HomeFinder.DataDir() }
func (e *Env) GetSharedDataDir() string    { return e.HomeFinder.SharedDataDir() }
func (e *Env) GetLogDir() string           { return e.HomeFinder.LogDir() }

func (e *Env) SendSystemChatMessages() bool {
	return !e.Test.SkipSendingSystemChatMessages
}

func (e *Env) UseTimeClockForNISTs() bool {
	return e.Test.UseTimeClockForNISTs
}

func (e *Env) GetRuntimeDir() string {
	return e.GetString(
		func() string { return e.Test.RuntimeDir },
		func() string { return e.HomeFinder.RuntimeDir() },
	)
}

func (e *Env) GetInfoDir() string {
	return e.GetString(
		func() string { return e.Test.RuntimeDir }, // needed for systests
		func() string { return e.HomeFinder.InfoDir() },
	)
}

func (e *Env) GetServiceSpawnDir() (string, error) { return e.HomeFinder.ServiceSpawnDir() }

func (e *Env) getEnvInt(s string) (int, bool) {
	v := os.Getenv(s)
	if len(v) > 0 {
		tmp, err := strconv.ParseInt(v, 0, 64)
		if err == nil {
			return int(tmp), true
		}
	}
	return 0, false
}

func (e *Env) getEnvPath(s string) []string {
	if tmp := os.Getenv(s); len(tmp) != 0 {
		return strings.Split(tmp, ":")
	}
	return nil
}

func (e *Env) getEnvBool(s string) (bool, bool) {
	return getEnvBool(s)
}

func getEnvBool(s string) (bool, bool) {
	tmp := os.Getenv(s)
	if len(tmp) == 0 {
		return false, false
	}
	tmp = strings.ToLower(tmp)
	if tmp == "0" || tmp[0] == byte('n') {
		return false, true
	}
	return true, true
}

func (e *Env) getEnvDuration(s string) (time.Duration, bool) {
	d, err := time.ParseDuration(os.Getenv(s))
	if err != nil {
		return 0, false
	}
	return d, true
}

func (e *Env) GetString(flist ...(func() string)) string {
	var ret string
	for _, f := range flist {
		ret = f()
		if len(ret) > 0 {
			break
		}
	}
	return ret
}

func (e *Env) GetBool(def bool, flist ...func() (bool, bool)) bool {
	for _, f := range flist {
		if val, isSet := f(); isSet {
			return val
		}
	}
	return def
}

type NegBoolFunc struct {
	neg bool
	f   func() (bool, bool)
}

// GetNegBool gets a negatable bool.  You can give it a list of functions,
// and also possible negations for those functions.
func (e *Env) GetNegBool(def bool, flist []NegBoolFunc) bool {
	for _, f := range flist {
		if val, isSet := f.f(); isSet {
			return (val != f.neg)
		}
	}
	return def
}

func (e *Env) GetInt(def int, flist ...func() (int, bool)) int {
	for _, f := range flist {
		if val, isSet := f(); isSet {
			return val
		}
	}
	return def
}

func (e *Env) GetDuration(def time.Duration, flist ...func() (time.Duration, bool)) time.Duration {
	for _, f := range flist {
		if val, isSet := f(); isSet {
			return val
		}
	}
	return def
}

func (e *Env) GetServerURI() (string, error) {
	// appveyor and os x travis CI set server URI, so need to
	// check for test flag here in order for production api endpoint
	// tests to pass.
	if e.Test.UseProductionRunMode {
		server, e := ServerLookup(e, e.GetRunMode())
		if e != nil {
			return "", nil
		}
		return server, nil
	}

	serverURI := e.GetString(
		func() string {
			serverURI, err := e.cmd.GetServerURI()
			if err != nil {
				return ""
			}
			return serverURI
		},
		func() string { return os.Getenv("KEYBASE_SERVER_URI") },
		func() string {
			serverURI, err := e.GetConfig().GetServerURI()
			if err != nil {
				return ""
			}
			return serverURI
		},
		func() string {
			serverURI, err := ServerLookup(e, e.GetRunMode())
			if err != nil {
				return ""
			}
			return serverURI
		},
	)

	if serverURI == "" {
		return "", fmt.Errorf("Env failed to read a server URI from any source!")
	}
	return serverURI, nil
}

func (e *Env) GetUseRootConfigFile() bool {
	return e.GetBool(false, e.cmd.GetUseRootConfigFile)
}

func (e *Env) GetRootRedirectorMount() (string, error) {
	switch RuntimeGroup() {
	case keybase1.RuntimeGroup_LINUXLIKE, keybase1.RuntimeGroup_DARWINLIKE:
		return "/keybase", nil
	default:
		return "", fmt.Errorf("Root redirector mount unknown on this system.")
	}
}

func (e *Env) GetRootConfigDirectory() (string, error) {
	// NOTE: If this ever changes to more than one level deep, the configure
	// redirector CLI command needs to be updated to update the permissions
	// back to 0644 for all the created directories, or other processes won't
	// be able to read them.
	// Alternatively, we could package a blank config.json in that directory,
	// but we can't rely on that for other packages.
	switch RuntimeGroup() {
	case keybase1.RuntimeGroup_LINUXLIKE:
		return "/etc/keybase/", nil
	default:
		return "", fmt.Errorf("Root config directory unknown on this system")
	}
}

func (e *Env) GetRootConfigFilename() (string, error) {
	dir, err := e.GetRootConfigDirectory()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "config.json"), nil
}

func (e *Env) GetEnvFileDir() (string, error) {
	switch RuntimeGroup() {
	case keybase1.RuntimeGroup_LINUXLIKE:
		// Do not respect $XDG_CONFIG_HOME due to debian systemd 229 not supporting %E
		// see keybase.service systemd unit
		return filepath.Join(e.GetHome(), ".config", "keybase"), nil
	default:
		return "", fmt.Errorf("No envfiledir for %s.", runtime.GOOS)
	}
}

func (e *Env) GetEnvfileName() (string, error) {
	dir, err := e.GetEnvFileDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "keybase.autogen.env"), nil
}

func (e *Env) GetOverrideEnvfileName() (string, error) {
	dir, err := e.GetEnvFileDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "keybase.env"), nil
}

func (e *Env) GetConfigFilename() string {
	return e.GetString(
		func() string {
			if e.GetUseRootConfigFile() {
				ret, err := e.GetRootConfigFilename()
				if err != nil {
					return ""
				}
				return ret
			}
			return ""
		},
		func() string { return e.Test.ConfigFilename },
		func() string { return e.cmd.GetConfigFilename() },
		func() string { return os.Getenv("KEYBASE_CONFIG_FILE") },
		func() string { return e.GetConfig().GetConfigFilename() },
		func() string { return filepath.Join(e.GetConfigDir(), ConfigFile) },
	)
}

func (e *Env) GetUpdaterConfigFilename() string {
	return e.GetString(
		func() string {
			if e.GetUseRootConfigFile() {
				dir, err := e.GetRootConfigDirectory()
				if err != nil {
					return ""
				}
				return filepath.Join(dir, UpdaterConfigFile)
			}
			return ""
		},
		func() string { return e.cmd.GetUpdaterConfigFilename() },
		func() string { return os.Getenv("KEYBASE_UPDATER_CONFIG_FILE") },
		func() string { return e.GetConfig().GetUpdaterConfigFilename() },
		func() string { return filepath.Join(e.GetConfigDir(), UpdaterConfigFile) },
	)
}

func (e *Env) GetGUIConfigFilename() string {
	return e.GetString(
		func() string {
			if e.GetUseRootConfigFile() {
				dir, err := e.GetRootConfigDirectory()
				if err != nil {
					return ""
				}
				return filepath.Join(dir, GUIConfigFile)
			}
			return ""
		},
		func() string { return e.cmd.GetGUIConfigFilename() },
		func() string { return os.Getenv("KEYBASE_GUI_CONFIG_FILE") },
		func() string { return e.GetConfig().GetGUIConfigFilename() },
		func() string { return filepath.Join(e.GetConfigDir(), GUIConfigFile) },
	)
}

func (e *Env) GetDeviceCloneStateFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetDeviceCloneStateFilename() },
		func() string { return os.Getenv("KEYBASE_DEVICE_CLONE_STATE_FILE") },
		func() string { return e.GetConfig().GetDeviceCloneStateFilename() },
		func() string { return filepath.Join(e.GetConfigDir(), DeviceCloneStateFile) },
	)
}

func (e *Env) GetSessionFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetSessionFilename() },
		func() string { return os.Getenv("KEYBASE_SESSION_FILE") },
		func() string { return e.GetConfig().GetSessionFilename() },
		func() string { return filepath.Join(e.GetCacheDir(), SessionFile) },
	)
}

func (e *Env) GetDbFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetDbFilename() },
		func() string { return os.Getenv("KEYBASE_DB_FILE") },
		func() string { return e.GetConfig().GetDbFilename() },
		func() string { return filepath.Join(e.GetDataDir(), DBFile) },
	)
}

func (e *Env) GetChatDbFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetChatDbFilename() },
		func() string { return os.Getenv("KEYBASE_CHAT_DB_FILE") },
		func() string { return e.GetConfig().GetChatDbFilename() },
		func() string { return filepath.Join(e.GetDataDir(), ChatDBFile) },
	)
}

// GetPvlKitFilename gets the path to pvl kit file.
// Its value is usually "" which means to use the server.
func (e *Env) GetPvlKitFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetPvlKitFilename() },
		func() string { return os.Getenv("KEYBASE_PVL_KIT_FILE") },
		func() string { return e.GetConfig().GetPvlKitFilename() },
	)
}

// GetParamProofKitFilename gets the path to param proof kit file.  Its value
// is usually "" which means to use the server.
func (e *Env) GetParamProofKitFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetParamProofKitFilename() },
		func() string { return os.Getenv("KEYBASE_PARAM_PROOF_KIT_FILE") },
		func() string { return e.GetConfig().GetParamProofKitFilename() },
	)
}

// GetExternalURLKitFilename gets the path to param proof kit file. Its value
// is usually "" which means to use the server.
func (e *Env) GetExternalURLKitFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetExternalURLKitFilename() },
		func() string { return os.Getenv("KEYBASE_EXTERNAL_URL_KIT_FILE") },
		func() string { return e.GetConfig().GetExternalURLKitFilename() },
	)
}

// GetProveBypass ignores creation_disabled so that the client will let the user
// try to make a proof for any known service.
func (e *Env) GetProveBypass() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetProveBypass() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_PROVE_BYPASS") },
		func() (bool, bool) { return e.GetConfig().GetProveBypass() })
}

// GetDebugJourneycard enables experimental chat journey cards.
func (e *Env) GetDebugJourneycard() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetDebugJourneycard() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_DEBUG_JOURNEYCARD") },
		func() (bool, bool) { return e.GetConfig().GetDebugJourneycard() })
}

func (e *Env) GetDebug() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.Test.GetDebug() },
		func() (bool, bool) { return e.cmd.GetDebug() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_DEBUG") },
		func() (bool, bool) { return e.GetConfig().GetDebug() },
	)
}

func (e *Env) GetDisplayRawUntrustedOutput() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetDisplayRawUntrustedOutput() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_DISPLAY_RAW_UNTRUSTED_OUTPUT") },
		func() (bool, bool) { return e.GetConfig().GetDisplayRawUntrustedOutput() },
	)
}

func (e *Env) GetAutoFork() bool {
	// On !Darwin, we auto-fork by default
	def := (runtime.GOOS != "darwin")
	return e.GetNegBool(def,
		[]NegBoolFunc{
			{
				neg: false,
				f:   func() (bool, bool) { return e.cmd.GetAutoFork() },
			},
			{
				neg: true,
				f:   func() (bool, bool) { return e.cmd.GetNoAutoFork() },
			},
			{
				neg: false,
				f:   func() (bool, bool) { return e.getEnvBool("KEYBASE_AUTO_FORK") },
			},
			{
				neg: true,
				f:   func() (bool, bool) { return e.getEnvBool("KEYBASE_NO_AUTO_FORK") },
			},
			{
				neg: false,
				f:   func() (bool, bool) { return e.GetConfig().GetAutoFork() },
			},
		},
	)
}

func (e *Env) GetStandalone() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetStandalone() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_STANDALONE") },
		func() (bool, bool) { return e.GetConfig().GetStandalone() },
	)
}

func (e *Env) GetLogFormat() string {
	return e.GetString(
		func() string { return e.cmd.GetLogFormat() },
		func() string { return os.Getenv("KEYBASE_LOG_FORMAT") },
		func() string { return e.GetConfig().GetLogFormat() },
	)
}

func (e *Env) GetLabel() string {
	return e.GetString(
		func() string { return e.cmd.GetString("label") },
		func() string { return os.Getenv("KEYBASE_LABEL") },
	)
}

func (e *Env) GetServiceType() string {
	return e.GetString(
		func() string { return os.Getenv("KEYBASE_SERVICE_TYPE") },
	)
}

func (e *Env) GetAPIDump() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetAPIDump() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_API_DUMP") },
	)
}

func (e *Env) GetAllowRoot() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_ALLOW_ROOT") },
	)
}

func (e *Env) GetUsername() NormalizedUsername {
	return e.GetConfig().GetUsername()
}

func (e *Env) GetSocketBindFile() (string, error) {
	return e.GetString(
		e.sandboxSocketFile,
		e.defaultSocketFile,
	), nil
}

func (e *Env) defaultSocketFile() string {
	socketFile := e.GetString(
		func() string { return e.cmd.GetSocketFile() },
		func() string { return os.Getenv("KEYBASE_SOCKET_FILE") },
		func() string { return e.GetConfig().GetSocketFile() },
	)
	if socketFile == "" {
		socketFile = filepath.Join(e.GetRuntimeDir(), SocketFile)
	}
	return socketFile
}

// sandboxSocketFile is socket file location for sandbox (macOS only)
// Note: this was added for KBFS finder integration, which was never
// activated.
func (e *Env) sandboxSocketFile() string {
	sandboxCacheDir := e.HomeFinder.SandboxCacheDir()
	if sandboxCacheDir == "" {
		return ""
	}
	return filepath.Join(sandboxCacheDir, SocketFile)
}

func (e *Env) GetSocketDialFiles() ([]string, error) {
	dialFiles := []string{}
	sandboxSocketFile := e.sandboxSocketFile()
	if sandboxSocketFile != "" {
		dialFiles = append(dialFiles, sandboxSocketFile)
	}
	dialFiles = append(dialFiles, e.defaultSocketFile())
	return dialFiles, nil
}

func (e *Env) GetGregorURI() string {
	return e.GetString(
		func() string { return os.Getenv("KEYBASE_PUSH_SERVER_URI") },
		func() string { return e.GetConfig().GetGregorURI() },
		func() string { return e.cmd.GetGregorURI() },
		func() string { return GregorServerLookup[e.GetRunMode()] },
	)
}

func (e *Env) GetGregorSaveInterval() time.Duration {
	return e.GetDuration(time.Minute,
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_PUSH_SAVE_INTERVAL") },
		func() (time.Duration, bool) { return e.GetConfig().GetGregorSaveInterval() },
		func() (time.Duration, bool) { return e.cmd.GetGregorSaveInterval() },
	)
}

func (e *Env) GetGregorDisabled() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.Test.GetNoGregor() },
		func() (bool, bool) { return e.cmd.GetGregorDisabled() },
		func() (bool, bool) { return getEnvBool("KEYBASE_PUSH_DISABLED") },
		func() (bool, bool) { return e.GetConfig().GetGregorDisabled() },
	)
}

func (e *Env) GetSecretStorePrimingDisabled() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.Test.GetSecretStorePrimingDisabled() },
	)
}

func (e *Env) GetBGIdentifierDisabled() bool {
	return e.GetBool(true,
		func() (bool, bool) { return e.cmd.GetBGIdentifierDisabled() },
		func() (bool, bool) { return getEnvBool("KEYBASE_BG_IDENTIFIER_DISABLED") },
		func() (bool, bool) { return e.GetConfig().GetBGIdentifierDisabled() },
	)
}

func (e *Env) GetGregorPingInterval() time.Duration {
	return e.GetDuration(10*time.Second,
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_PUSH_PING_INTERVAL") },
		func() (time.Duration, bool) { return e.GetConfig().GetGregorPingInterval() },
		func() (time.Duration, bool) { return e.cmd.GetGregorPingInterval() },
	)
}

func (e *Env) GetGregorPingTimeout() time.Duration {
	return e.GetDuration(5*time.Second,
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_PUSH_PING_TIMEOUT") },
		func() (time.Duration, bool) { return e.GetConfig().GetGregorPingTimeout() },
		func() (time.Duration, bool) { return e.cmd.GetGregorPingTimeout() },
	)
}

func (e *Env) GetChatDelivererInterval() time.Duration {
	return e.GetDuration(5*time.Second,
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_CHAT_DELIVERER_INTERVAL") },
		func() (time.Duration, bool) { return e.GetConfig().GetChatDelivererInterval() },
		func() (time.Duration, bool) { return e.cmd.GetChatDelivererInterval() },
	)
}

func (e *Env) GetAttachmentHTTPStartPort() int {
	return e.GetInt(16423,
		e.cmd.GetAttachmentHTTPStartPort,
		func() (int, bool) { return e.getEnvInt("KEYBASE_ATTACHMENT_HTTP_START") },
		e.GetConfig().GetAttachmentHTTPStartPort,
	)
}

func (e *Env) GetAttachmentDisableMulti() bool {
	return e.GetBool(false,
		e.cmd.GetAttachmentDisableMulti,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_ATTACHMENT_DISABLE_MULTI") },
		e.GetConfig().GetAttachmentDisableMulti,
	)
}

func (e *Env) GetDisableTeamAuditor() bool {
	return e.GetBool(false,
		e.cmd.GetDisableTeamAuditor,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_DISABLE_TEAM_AUDITOR") },
		e.GetConfig().GetDisableTeamAuditor,
		// If unset, use the BotLite setting
		func() (bool, bool) { return e.GetEnableBotLiteMode(), true },
	)
}

func (e *Env) GetDisableTeamBoxAuditor() bool {
	return e.GetBool(false,
		e.cmd.GetDisableTeamBoxAuditor,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_DISABLE_TEAM_BOX_AUDITOR") },
		e.GetConfig().GetDisableTeamBoxAuditor,
		// If unset, use the BotLite setting
		func() (bool, bool) { return e.GetEnableBotLiteMode(), true },
	)
}

func (e *Env) GetDisableEKBackgroundKeygen() bool {
	return e.GetBool(false,
		e.cmd.GetDisableEKBackgroundKeygen,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_DISABLE_EK_BACKGROUND_KEYGEN") },
		e.GetConfig().GetDisableEKBackgroundKeygen,
	)
}

func (e *Env) GetDisableMerkleAuditor() bool {
	return e.GetBool(false,
		e.cmd.GetDisableMerkleAuditor,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_DISABLE_MERKLE_AUDITOR") },
		e.GetConfig().GetDisableMerkleAuditor,
		// If unset, use the BotLite setting
		func() (bool, bool) { return e.GetEnableBotLiteMode(), true },
	)
}

func (e *Env) GetDisableSearchIndexer() bool {
	return e.GetBool(false,
		e.cmd.GetDisableSearchIndexer,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_DISABLE_SEARCH_INDEXER") },
		e.GetConfig().GetDisableSearchIndexer,
		// If unset, use the BotLite setting
		func() (bool, bool) { return e.GetEnableBotLiteMode(), true },
	)
}

func (e *Env) GetDisableBgConvLoader() bool {
	return e.GetBool(false,
		e.cmd.GetDisableBgConvLoader,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_DISABLE_BG_CONV_LOADER") },
		e.GetConfig().GetDisableBgConvLoader,
		// If unset, use the BotLite setting
		func() (bool, bool) { return e.GetEnableBotLiteMode(), true },
	)
}

func (e *Env) GetEnableBotLiteMode() bool {
	return e.GetBool(false,
		e.cmd.GetEnableBotLiteMode,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_ENABLE_BOT_LITE_MODE") },
		e.GetConfig().GetEnableBotLiteMode,
	)
}

func (e *Env) GetExtraNetLogging() bool {
	return e.GetBool(false,
		e.cmd.GetExtraNetLogging,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_EXTRA_NET_LOGGING") },
		e.GetConfig().GetExtraNetLogging,
	)
}

func (e *Env) GetPidFile() (ret string, err error) {
	ret = e.GetString(
		func() string { return e.cmd.GetPidFile() },
		func() string { return os.Getenv("KEYBASE_PID_FILE") },
		func() string { return e.GetConfig().GetPidFile() },
	)
	if len(ret) == 0 {
		ret = filepath.Join(e.GetInfoDir(), PIDFile)
	}
	return
}

func (e *Env) GetEmail() string {
	return e.GetString(
		func() string { return os.Getenv("KEYBASE_EMAIL") },
	)
}

func (e *Env) GetStayLoggedOut() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.GetConfig().GetStayLoggedOut() },
	)
}

// Upgrade sigchains to contain per-user-keys.
func (e *Env) GetUpgradePerUserKey() bool {
	return !e.Test.DisableUpgradePerUserKey
}

// If true, do not logout after user.key_change notification handler
// decides that current device has been revoked.
func (e *Env) GetSkipLogoutIfRevokedCheck() bool {
	return e.Test.SkipLogoutIfRevokedCheck
}

// Get the ProxyType based off of the configured proxy and tor settings
func (e *Env) GetProxyType() ProxyType {
	if e.GetTorMode() != TorNone {
		// Tor mode is enabled. Tor mode is implemented via a socks proxy
		return Socks
	}
	var proxyTypeStr = e.GetString(
		func() string { return e.cmd.GetProxyType() },
		func() string { return os.Getenv("PROXY_TYPE") },
		func() string { return e.GetConfig().GetProxyType() },
	)
	return ProxyTypeStrToEnumFunc(proxyTypeStr)
}

func ProxyTypeStrToEnumFunc(proxyTypeStr string) ProxyType {
	proxyType, ok := ProxyTypeStrToEnum[strings.ToLower(proxyTypeStr)]
	if ok {
		return proxyType
	}
	// If they give us a bogus proxy type we just don't enable a proxy
	return NoProxy
}

// Get the address (optionally including a port) of the currently configured proxy. Returns an empty string if no proxy
// is configured.
func (e *Env) GetProxy() string {
	return e.GetString(
		func() string {
			// Only return the tor proxy address if tor mode is enabled to ensure we fall through to the other options
			if e.GetTorMode() != TorNone {
				return e.GetTorProxy()
			}
			return ""
		},
		// Prioritze tor mode over configured proxies
		func() string { return e.cmd.GetProxy() },
		func() string { return e.GetConfig().GetProxy() },
		func() string { return os.Getenv("PROXY") },
		// Prioritize the keybase specific methods of configuring a proxy above the standard unix env variables
		func() string { return os.Getenv("HTTPS_PROXY") },
		func() string { return os.Getenv("HTTP_PROXY") },
	)
}

func (e *Env) IsCertPinningEnabled() bool {
	// SSL Pinning is enabled if none of the config options say it is disabled
	if !e.cmd.IsCertPinningEnabled() {
		return false
	}
	res, isSet := e.getEnvBool("DISABLE_SSL_PINNING")
	if isSet && res {
		return false
	}
	if !e.GetConfig().IsCertPinningEnabled() {
		return false
	}
	return true
}

func (e *Env) GetGpgHome() string {
	return e.GetString(
		func() string { return e.Test.GPGHome },
		func() string { return e.cmd.GetGpgHome() },
		func() string { return os.Getenv("GNUPGHOME") },
		func() string { return e.GetConfig().GetGpgHome() },
		func() string { return filepath.Join(e.GetHome(), ".gnupg") },
	)
}

func (e *Env) GetPinentry() string {
	return e.GetString(
		func() string { return e.cmd.GetPinentry() },
		func() string { return os.Getenv("KEYBASE_PINENTRY") },
		func() string { return e.GetConfig().GetPinentry() },
	)
}

func (e *Env) GetNoPinentry() bool {

	isno := func(s string) (bool, bool) {
		s = strings.ToLower(s)
		if s == "0" || s == "no" || s == "n" || s == "none" {
			return true, true
		}
		return false, false
	}

	return e.GetBool(false,
		func() (bool, bool) { return isno(e.cmd.GetPinentry()) },
		func() (bool, bool) { return isno(os.Getenv("KEYBASE_PINENTRY")) },
		func() (bool, bool) { return e.GetConfig().GetNoPinentry() },
	)
}

func (e *Env) GetBundledCA(host string) string {
	return e.GetString(
		func() string { return e.GetConfig().GetBundledCA(host) },
		func() string {
			ret, ok := GetBundledCAsFromHost(host)
			if !ok {
				return ""
			}
			return string(ret)
		},
	)
}

func (e *Env) GetUserCacheMaxAge() time.Duration {
	return e.GetDuration(UserCacheMaxAge,
		func() (time.Duration, bool) { return e.cmd.GetUserCacheMaxAge() },
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_USER_CACHE_MAX_AGE") },
		func() (time.Duration, bool) { return e.GetConfig().GetUserCacheMaxAge() },
	)
}

func (e *Env) GetAPITimeout() time.Duration {
	return e.GetDuration(HTTPDefaultTimeout,
		func() (time.Duration, bool) { return e.cmd.GetAPITimeout() },
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_API_TIMEOUT") },
		func() (time.Duration, bool) { return e.GetConfig().GetAPITimeout() },
	)
}

func (e *Env) GetScraperTimeout() time.Duration {
	return e.GetDuration(HTTPDefaultScraperTimeout,
		func() (time.Duration, bool) { return e.cmd.GetScraperTimeout() },
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_SCRAPER_TIMEOUT") },
		func() (time.Duration, bool) { return e.GetConfig().GetScraperTimeout() },
	)
}

func (e *Env) GetLocalTrackMaxAge() time.Duration {
	return e.GetDuration(LocalTrackMaxAge,
		func() (time.Duration, bool) { return e.cmd.GetLocalTrackMaxAge() },
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_LOCAL_TRACK_MAX_AGE") },
		func() (time.Duration, bool) { return e.GetConfig().GetLocalTrackMaxAge() },
	)
}
func (e *Env) GetProofCacheSize() int {
	return e.GetInt(ProofCacheSize,
		e.cmd.GetProofCacheSize,
		func() (int, bool) { return e.getEnvInt("KEYBASE_PROOF_CACHE_SIZE") },
		e.GetConfig().GetProofCacheSize,
	)
}

func (e *Env) GetProofCacheLongDur() time.Duration {
	return e.GetDuration(ProofCacheLongDur,
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_PROOF_CACHE_LONG_DUR") },
		e.GetConfig().GetProofCacheLongDur,
	)
}

func (e *Env) GetProofCacheMediumDur() time.Duration {
	return e.GetDuration(ProofCacheMediumDur,
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_PROOF_CACHE_MEDIUM_DUR") },
		e.GetConfig().GetProofCacheMediumDur,
	)
}

func (e *Env) GetProofCacheShortDur() time.Duration {
	return e.GetDuration(ProofCacheShortDur,
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_PROOF_CACHE_SHORT_DUR") },
		e.GetConfig().GetProofCacheShortDur,
	)
}

func (e *Env) GetLinkCacheSize() int {
	return e.GetInt(LinkCacheSize,
		e.cmd.GetLinkCacheSize,
		func() (int, bool) { return e.getEnvInt("KEYBASE_LINK_CACHE_SIZE") },
		e.GetConfig().GetLinkCacheSize,
	)
}

func (e *Env) GetUPAKCacheSize() int {
	return e.GetInt(UPAKCacheSize,
		e.cmd.GetUPAKCacheSize,
		func() (int, bool) { return e.getEnvInt("KEYBASE_UPAK_CACHE_SIZE") },
		e.GetConfig().GetUPAKCacheSize,
	)
}

func (e *Env) GetUIDMapFullNameCacheSize() int {
	return e.GetInt(UIDMapFullNameCacheSize,
		e.cmd.GetUIDMapFullNameCacheSize,
		func() (int, bool) { return e.getEnvInt("KEYBASE_UID_MAP_FULL_NAME_CACHE_SIZE") },
		e.GetConfig().GetUIDMapFullNameCacheSize,
	)
}

func (e *Env) GetLevelDBNumFiles() int {
	return e.GetInt(LevelDBNumFiles,
		e.cmd.GetLevelDBNumFiles,
		func() (int, bool) { return e.getEnvInt("KEYBASE_LEVELDB_NUM_FILES") },
		e.GetConfig().GetLevelDBNumFiles,
	)
}

func (e *Env) GetLevelDBWriteBufferMB() int {
	return e.GetInt(LevelDBWriteBufferMB,
		e.cmd.GetLevelDBWriteBufferMB,
		func() (int, bool) { return e.getEnvInt("KEYBASE_LEVELDB_WRITE_BUFFER_MB") },
		e.GetConfig().GetLevelDBWriteBufferMB,
	)
}

func (e *Env) GetLinkCacheCleanDur() time.Duration {
	return e.GetDuration(LinkCacheCleanDur,
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_LINK_CACHE_CLEAN_DUR") },
		e.GetConfig().GetLinkCacheCleanDur,
	)
}

func (e *Env) GetPayloadCacheSize() int {
	return e.GetInt(PayloadCacheSize,
		e.cmd.GetPayloadCacheSize,
		func() (int, bool) { return e.getEnvInt("KEYBASE_PAYLOAD_CACHE_SIZE") },
		e.GetConfig().GetPayloadCacheSize,
	)
}

func (e *Env) GetEmailOrUsername() string {
	un := e.GetUsername().String()
	if len(un) > 0 {
		return un
	}
	em := e.GetEmail()
	return em
}

func (e *Env) GetRunMode() RunMode {
	// If testing production run mode, then use it:
	if e.Test.UseProductionRunMode {
		return ProductionRunMode
	}

	var ret RunMode

	pick := func(m RunMode, err error) {
		if ret == NoRunMode && err == nil {
			ret = m
		}
	}

	pick(e.cmd.GetRunMode())
	pick(StringToRunMode(os.Getenv("KEYBASE_RUN_MODE")))
	pick(e.GetConfig().GetRunMode())
	pick(DefaultRunMode, nil)

	// If we aren't running in devel or staging and we're testing. Let's run in devel.
	if e.Test.Devel && ret != DevelRunMode && ret != StagingRunMode {
		return DevelRunMode
	}

	return ret
}

func (e *Env) GetAppType() AppType {
	switch {
	case e.cmd.GetAppType() != NoAppType:
		return e.cmd.GetAppType()
	case StringToAppType(os.Getenv("KEYBASE_APP_TYPE")) != NoAppType:
		return StringToAppType(os.Getenv("KEYBASE_APP_TYPE"))
	case e.GetConfig().GetAppType() != NoAppType:
		return e.GetConfig().GetAppType()
	default:
		return NoAppType
	}
}

func (e *Env) IsMobileExtension() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.IsMobileExtension() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_MOBILE_EXTENSION") },
		func() (bool, bool) { return e.GetConfig().IsMobileExtension() },
	)
}

func (e *Env) GetSlowGregorConn() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetSlowGregorConn() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_SLOW_GREGOR_CONN") },
		func() (bool, bool) { return e.GetConfig().GetSlowGregorConn() },
	)
}

func (e *Env) GetReadDeletedSigChain() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetReadDeletedSigChain() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_READ_DELETED_SIGCHAIN") },
		func() (bool, bool) { return e.GetConfig().GetReadDeletedSigChain() },
	)
}

func (e *Env) GetFeatureFlags() FeatureFlags {
	var ret FeatureFlags
	pick := func(f FeatureFlags, err error) {
		if ret.Empty() && err == nil {
			ret = f
		}
	}
	if e.Test.EnvironmentFeatureFlags != nil {
		pick(e.Test.EnvironmentFeatureFlags, nil)
	}
	pick(e.cmd.GetFeatureFlags())
	pick(StringToFeatureFlags(os.Getenv("KEYBASE_FEATURES")), nil)
	pick(e.GetConfig().GetFeatureFlags())
	return ret
}

func (e *Env) GetUID() keybase1.UID { return e.GetConfig().GetUID() }

func (e *Env) GetStringList(list ...(func() []string)) []string {
	for _, f := range list {
		if res := f(); res != nil {
			return res
		}
	}
	return []string{}
}

func (e *Env) GetMerkleKIDs() []keybase1.KID {
	slist := e.GetStringList(
		func() []string { return e.cmd.GetMerkleKIDs() },
		func() []string { return e.getEnvPath("KEYBASE_MERKLE_KIDS") },
		func() []string { return e.GetConfig().GetMerkleKIDs() },
		func() []string {
			ret := MerkleProdKIDs
			if e.GetRunMode() == DevelRunMode || e.GetRunMode() == StagingRunMode {
				ret = append(ret, MerkleTestKIDs...)
				ret = append(ret, MerkleStagingKIDs...)
			}
			return ret
		},
	)

	if slist == nil {
		return nil
	}
	var ret []keybase1.KID
	for _, s := range slist {
		ret = append(ret, keybase1.KIDFromString(s))
	}

	return ret
}

func (e *Env) GetCodeSigningKIDs() []keybase1.KID {
	slist := e.GetStringList(
		func() []string { return e.cmd.GetCodeSigningKIDs() },
		func() []string { return e.getEnvPath("KEYBASE_CODE_SIGNING_KIDS") },
		func() []string { return e.GetConfig().GetCodeSigningKIDs() },
		func() []string {
			ret := CodeSigningProdKIDs
			if e.GetRunMode() == DevelRunMode || e.GetRunMode() == StagingRunMode {
				ret = append(ret, CodeSigningTestKIDs...)
				ret = append(ret, CodeSigningStagingKIDs...)
			}
			return ret
		},
	)

	if slist == nil {
		return nil
	}
	var ret []keybase1.KID
	for _, s := range slist {
		ret = append(ret, keybase1.KIDFromString(s))
	}

	return ret
}

func (e *Env) GetGpg() string {
	return e.GetString(
		func() string { return e.Test.GPG },
		func() string { return e.cmd.GetGpg() },
		func() string { return os.Getenv("GPG") },
		func() string { return e.GetConfig().GetGpg() },
	)
}

func (e *Env) GetGpgOptions() []string {
	return e.GetStringList(
		func() []string { return e.Test.GPGOptions },
		func() []string { return e.cmd.GetGpgOptions() },
		func() []string { return e.GetConfig().GetGpgOptions() },
	)
}

func (e *Env) GetSecretKeyringTemplate() string {
	return e.GetString(
		func() string { return e.cmd.GetSecretKeyringTemplate() },
		func() string { return os.Getenv("KEYBASE_SECRET_KEYRING_TEMPLATE") },
		func() string { return e.GetConfig().GetSecretKeyringTemplate() },
		func() string { return filepath.Join(e.GetConfigDir(), SecretKeyringTemplate) },
	)
}

func (e *Env) GetLocalRPCDebug() string {
	return e.GetString(
		func() string { return e.cmd.GetLocalRPCDebug() },
		func() string { return os.Getenv("KEYBASE_LOCAL_RPC_DEBUG") },
		func() string { return e.GetConfig().GetLocalRPCDebug() },
	)
}

func (e *Env) GetDoLogForward() bool {
	return e.GetLocalRPCDebug() == ""
}

func (e *Env) GetTimers() string {
	return e.GetString(
		func() string { return e.cmd.GetTimers() },
		func() string { return os.Getenv("KEYBASE_TIMERS") },
		func() string { return e.GetConfig().GetTimers() },
	)
}

func (e *Env) GetConvSourceType() string {
	return e.GetString(
		func() string { return os.Getenv("KEYBASE_CONV_SOURCE_TYPE") },
		func() string { return "hybrid" },
	)
}

func (e *Env) GetInboxSourceType() string {
	return e.GetString(
		func() string { return os.Getenv("KEYBASE_INBOX_SOURCE_TYPE") },
		func() string { return "hybrid" },
	)
}

func (e *Env) GetChatInboxSourceLocalizeThreads() int {
	return e.GetInt(
		10,
		e.cmd.GetChatInboxSourceLocalizeThreads,
		func() (int, bool) { return e.getEnvInt("KEYBASE_INBOX_SOURCE_LOCALIZE_THREADS") },
		e.GetConfig().GetChatInboxSourceLocalizeThreads,
	)
}

// GetChatMemberType returns the default member type for new conversations.
func (e *Env) GetChatMemberType() string {
	return e.GetString(
		func() string { return os.Getenv("KEYBASE_CHAT_MEMBER_TYPE") },
		func() string { return "impteam" },
	)
}

func (e *Env) GetAvatarSource() string {
	return e.GetString(
		func() string { return os.Getenv("KEYBASE_AVATAR_SOURCE") },
		func() string { return "full" },
	)
}

func (e *Env) GetDeviceID() keybase1.DeviceID {
	return e.GetConfig().GetDeviceID()
}

func (e *Env) GetDeviceIDForUsername(u NormalizedUsername) keybase1.DeviceID {
	return e.GetConfig().GetDeviceIDForUsername(u)
}

func (e *Env) GetDeviceIDForUID(u keybase1.UID) keybase1.DeviceID {
	return e.GetConfig().GetDeviceIDForUID(u)
}

func (e *Env) GetUsernameForUID(u keybase1.UID) NormalizedUsername {
	return e.GetConfig().GetUsernameForUID(u)
}

func (e *Env) GetInstallID() (ret InstallID) {
	if rdr := e.GetUpdaterConfig(); rdr != nil {
		ret = rdr.GetInstallID()
	}
	return ret
}

func (e *Env) GetEffectiveLogFile() (filename string, ok bool) {
	logFile := e.GetLogFile()
	if logFile != "" {
		return logFile, true
	}

	filePrefix := e.GetLogPrefix()
	if filePrefix != "" {
		filePrefix += time.Now().Format("20060102T150405.999999999Z0700")
		logFile = filePrefix + ".log"
		return logFile, true
	}

	return e.GetDefaultLogFile(), e.GetUseDefaultLogFile()
}

func (e *Env) GetLogFile() string {
	return e.GetString(
		func() string { return e.cmd.GetLogFile() },
		func() string { return os.Getenv("KEYBASE_LOG_FILE") },
	)
}

func (e *Env) GetEKLogFile() string {
	return e.GetString(
		func() string { return e.cmd.GetEKLogFile() },
		func() string { return os.Getenv("KEYBASE_EK_LOG_FILE") },
		func() string { return filepath.Join(e.GetLogDir(), EKLogFileName) },
	)
}

func (e *Env) GetPerfLogFile() string {
	return e.GetString(
		func() string { return e.cmd.GetPerfLogFile() },
		func() string { return os.Getenv("KEYBASE_PERF_LOG_FILE") },
		func() string { return filepath.Join(e.GetLogDir(), PerfLogFileName) },
	)
}

func (e *Env) GetGUILogFile() string {
	return e.GetString(
		func() string { return e.cmd.GetGUILogFile() },
		func() string { return os.Getenv("KEYBASE_GUI_LOG_FILE") },
		func() string { return filepath.Join(e.GetLogDir(), GUILogFileName) },
	)
}

func (e *Env) GetUseDefaultLogFile() bool {
	return e.GetBool(false,
		e.cmd.GetUseDefaultLogFile,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_USE_DEFAULT_LOG_FILE") },
	)
}

func (e *Env) GetLogPrefix() string {
	return e.cmd.GetLogPrefix()
}

func (e *Env) GetDefaultLogFile() string {
	return filepath.Join(e.GetLogDir(), ServiceLogFileName)
}

func (e *Env) GetTorMode() TorMode {
	var ret TorMode

	pick := func(m TorMode, err error) {
		if ret == TorNone && err == nil {
			ret = m
		}
	}

	pick(e.cmd.GetTorMode())
	pick(StringToTorMode(os.Getenv("KEYBASE_TOR_MODE")))
	pick(e.GetConfig().GetTorMode())

	return ret
}

func (e *Env) GetTorHiddenAddress() string {
	return e.GetString(
		func() string { return e.cmd.GetTorHiddenAddress() },
		func() string { return os.Getenv("KEYBASE_TOR_HIDDEN_ADDRESS") },
		func() string { return e.GetConfig().GetTorHiddenAddress() },
		func() string { return TorServerURI },
	)
}

func (e *Env) GetTorProxy() string {
	return e.GetString(
		func() string { return e.cmd.GetTorProxy() },
		func() string { return os.Getenv("KEYBASE_TOR_PROXY") },
		func() string { return e.GetConfig().GetTorProxy() },
		func() string { return TorProxy },
	)
}

func (e *Env) GetStoredSecretAccessGroup() string {
	var override = e.GetBool(
		false,
		func() (bool, bool) { return e.GetConfig().GetSecurityAccessGroupOverride() },
	)

	if override {
		return ""
	}
	return "99229SGT5K.group.keybase"
}

func (e *Env) GetStoredSecretServiceBaseName() string {
	var serviceName string
	switch e.GetRunMode() {
	case DevelRunMode:
		serviceName = "keybase-devel"
	case StagingRunMode:
		serviceName = "keybase-staging"
	case ProductionRunMode:
		serviceName = "keybase"
	default:
		panic("Invalid run mode")
	}
	if e.Test.Devel {
		// Append DevelName so that tests won't clobber each
		// other's keychain entries on shutdown.
		serviceName += "-test"
	}
	return serviceName
}

func (e *Env) GetStoredSecretServiceName() string {
	serviceName := e.GetStoredSecretServiceBaseName()
	if e.Test.Devel {
		// Append DevelName so that tests won't clobber each
		// other's keychain entries on shutdown.
		serviceName += fmt.Sprintf("(%s)", e.Test.DevelName)
	}
	return serviceName
}

type AppConfig struct {
	NullConfiguration
	DownloadsDir                   string
	HomeDir                        string
	MobileSharedHomeDir            string
	LogFile                        string
	EKLogFile                      string
	PerfLogFile                    string
	GUILogFile                     string
	UseDefaultLogFile              bool
	RunMode                        RunMode
	Debug                          bool
	LocalRPCDebug                  string
	ServerURI                      string
	VDebugSetting                  string
	SecurityAccessGroupOverride    bool
	ChatInboxSourceLocalizeThreads int
	MobileExtension                bool
	AttachmentHTTPStartPort        int
	AttachmentDisableMulti         bool
	LinkCacheSize                  int
	UPAKCacheSize                  int
	PayloadCacheSize               int
	ProofCacheSize                 int
	DisableTeamAuditor             bool
	DisableMerkleAuditor           bool
	DisableTeamBoxAuditor          bool
	DisableEKBackgroundKeygen      bool
	LevelDBWriteBufferMB           int
	LevelDBNumFiles                int
}

var _ CommandLine = AppConfig{}

func (c AppConfig) GetLogFile() string {
	return c.LogFile
}

func (c AppConfig) GetEKLogFile() string {
	return c.EKLogFile
}

func (c AppConfig) GetPerfLogFile() string {
	return c.PerfLogFile
}

func (c AppConfig) GetGUILogFile() string {
	return c.GUILogFile
}

func (c AppConfig) GetUseDefaultLogFile() (bool, bool) {
	return c.UseDefaultLogFile, true
}

func (c AppConfig) GetDebug() (bool, bool) {
	return c.Debug, c.Debug
}

func (c AppConfig) GetLocalRPCDebug() string {
	return c.LocalRPCDebug
}

func (c AppConfig) GetRunMode() (RunMode, error) {
	return c.RunMode, nil
}

func (c AppConfig) GetDownloadsDir() string {
	return c.DownloadsDir
}

func (c AppConfig) GetHome() string {
	return c.HomeDir
}

func (c AppConfig) GetMobileSharedHome() string {
	return c.MobileSharedHomeDir
}

func (c AppConfig) GetServerURI() (string, error) {
	return c.ServerURI, nil
}

func (c AppConfig) GetSecurityAccessGroupOverride() (bool, bool) {
	return c.SecurityAccessGroupOverride, c.SecurityAccessGroupOverride
}

func (c AppConfig) GetAppType() AppType {
	return MobileAppType
}

func (c AppConfig) IsMobileExtension() (bool, bool) {
	return c.MobileExtension, true
}

func (c AppConfig) GetSlowGregorConn() (bool, bool) {
	return false, false
}

func (c AppConfig) GetReadDeletedSigChain() (bool, bool) {
	return false, false
}

func (c AppConfig) GetVDebugSetting() string {
	return c.VDebugSetting
}

func (c AppConfig) GetChatInboxSourceLocalizeThreads() (int, bool) {
	return c.ChatInboxSourceLocalizeThreads, true
}

func (c AppConfig) GetLevelDBWriteBufferMB() (int, bool) {
	if c.LevelDBWriteBufferMB > 0 {
		return c.LevelDBWriteBufferMB, true
	}
	return LevelDBWriteBufferMBMobile, true
}

func (c AppConfig) GetLevelDBNumFiles() (int, bool) {
	if c.LevelDBNumFiles > 0 {
		return c.LevelDBNumFiles, true
	}
	return LevelDBNumFiles, true
}

func (c AppConfig) GetAttachmentHTTPStartPort() (int, bool) {
	if c.AttachmentHTTPStartPort != 0 {
		return c.AttachmentHTTPStartPort, true
	}
	return 0, false
}

func (c AppConfig) GetLinkCacheSize() (int, bool) {
	if c.LinkCacheSize != 0 {
		return c.LinkCacheSize, true
	}
	return 0, false
}

func (c AppConfig) GetUPAKCacheSize() (int, bool) {
	if c.UPAKCacheSize != 0 {
		return c.UPAKCacheSize, true
	}
	return 0, false
}

func (c AppConfig) GetPayloadCacheSize() (int, bool) {
	if c.PayloadCacheSize != 0 {
		return c.PayloadCacheSize, true
	}
	return 0, false
}

func (c AppConfig) GetProofCacheSize() (int, bool) {
	if c.ProofCacheSize != 0 {
		return c.ProofCacheSize, true
	}
	return 0, false
}

func (c AppConfig) GetDisableTeamAuditor() (bool, bool) {
	return c.DisableTeamAuditor, true
}

func (c AppConfig) GetDisableMerkleAuditor() (bool, bool) {
	return c.DisableMerkleAuditor, true
}

func (c AppConfig) GetDisableTeamBoxAuditor() (bool, bool) {
	return c.DisableTeamBoxAuditor, true
}

func (c AppConfig) GetDisableEKBackgroundKeygen() (bool, bool) {
	return c.DisableEKBackgroundKeygen, true
}

func (c AppConfig) GetAttachmentDisableMulti() (bool, bool) {
	return c.AttachmentDisableMulti, true
}

func (e *Env) GetUpdatePreferenceAuto() (bool, bool) {
	return e.GetConfig().GetUpdatePreferenceAuto()
}

func (e *Env) GetUpdatePreferenceSkip() string {
	return e.GetConfig().GetUpdatePreferenceSkip()
}

func (e *Env) GetUpdatePreferenceSnoozeUntil() keybase1.Time {
	return e.GetConfig().GetUpdatePreferenceSnoozeUntil()
}

func (e *Env) GetUpdateLastChecked() keybase1.Time {
	return e.GetConfig().GetUpdateLastChecked()
}

func (e *Env) SetUpdatePreferenceAuto(b bool) error {
	return e.GetConfigWriter().SetUpdatePreferenceAuto(b)
}

func (e *Env) SetUpdatePreferenceSkip(v string) error {
	return e.GetConfigWriter().SetUpdatePreferenceSkip(v)
}

func (e *Env) SetUpdatePreferenceSnoozeUntil(t keybase1.Time) error {
	return e.GetConfigWriter().SetUpdatePreferenceSnoozeUntil(t)
}

func (e *Env) SetUpdateLastChecked(t keybase1.Time) error {
	return e.GetConfigWriter().SetUpdateLastChecked(t)
}

func (e *Env) GetUpdateURL() string {
	return e.GetConfig().GetUpdateURL()
}

func (e *Env) GetUpdateDisabled() (bool, bool) {
	return e.GetConfig().GetUpdateDisabled()
}

func (e *Env) GetVDebugSetting() string {
	return e.GetString(
		func() string { return e.cmd.GetVDebugSetting() },
		func() string { return os.Getenv("KEYBASE_VDEBUG") },
		func() string { return e.GetConfig().GetVDebugSetting() },
		func() string { return "" },
	)
}

func (e *Env) GetRunModeAsString() string {
	return string(e.GetRunMode())
}

// GetServiceInfoPath returns path to info file written by the Keybase service after startup
func (e *Env) GetServiceInfoPath() string {
	return filepath.Join(e.GetRuntimeDir(), "keybased.info")
}

// GetKBFSInfoPath returns path to info file written by the KBFS service after startup
func (e *Env) GetKBFSInfoPath() string {
	return filepath.Join(e.GetRuntimeDir(), "kbfs.info")
}

func (e *Env) GetUpdateDefaultInstructions() (string, error) {
	return PlatformSpecificUpgradeInstructionsString()
}

func (e *Env) RunningInCI() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_RUN_CI") },
	)
}

func (e *Env) WantsSystemd() bool {
	isNonstandard, isNonstandardErr := e.HomeFinder.IsNonstandardHome()
	return (e.GetRunMode() == ProductionRunMode && e.ModelessWantsSystemd() && (isNonstandardErr != nil || !isNonstandard))
}

func (e *Env) ModelessWantsSystemd() bool {
	return (systemd.IsRunningSystemd() &&
		os.Getenv("KEYBASE_SYSTEMD") != "0")
}

func (e *Env) ForceSecretStoreFile() bool {
	// By default use system-provided secret store (like MacOS Keychain), but
	// allow users to fall back to file-based store for testing and debugging.
	return e.GetBool(false,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_SECRET_STORE_FILE") },
		func() (bool, bool) { return e.GetConfig().GetForceSecretStoreFile() },
	)
}

func (e *Env) GetRuntimeStatsEnabled() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_RUNTIME_STATS_ENABLED") },
		func() (bool, bool) { return e.GetConfig().GetRuntimeStatsEnabled() },
	)
}

func (e *Env) GetRememberPassphrase(username NormalizedUsername) bool {
	return e.GetBool(true,
		func() (bool, bool) { return e.cmd.GetRememberPassphrase(username) },
		func() (bool, bool) { return e.GetConfig().GetRememberPassphrase(username) },
	)
}

func GetPlatformString() string {
	if IsIPad {
		return "ipad"
	}
	if isIOS {
		return "ios"
	}
	return runtime.GOOS
}

func IsMobilePlatform() bool {
	s := GetPlatformString()
	return (s == "ios" || s == "android" || s == "ipad")
}

func IsAndroid() bool {
	return GetPlatformString() == "android"
}

func (e *Env) AllowPTrace() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.getEnvBool("KEYBASE_ALLOW_PTRACE") },
	)
}

func (e *Env) GetLogFileConfig(filename string) *logger.LogFileConfig {
	var maxKeepFiles int
	var maxSize int64

	if e.GetAppType() == MobileAppType && !e.GetFeatureFlags().Admin(e.GetUID()) {
		maxKeepFiles = 2
		maxSize = 16 * opt.MiB
	} else {
		maxKeepFiles = 3
		maxSize = 128 * opt.MiB
	}

	return &logger.LogFileConfig{
		Path:         filename,
		MaxAge:       30 * 24 * time.Hour, // 30 days
		MaxSize:      maxSize,
		MaxKeepFiles: maxKeepFiles,
	}
}
func (e *Env) GetForceLinuxKeyring() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetForceLinuxKeyring() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_FORCE_LINUX_KEYRING") },
		func() (bool, bool) { return e.GetConfig().GetForceLinuxKeyring() })
}
