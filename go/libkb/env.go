package libkb

import (
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
)

type NullConfiguration struct{}

func (n NullConfiguration) GetHome() string                               { return "" }
func (n NullConfiguration) GetServerURI() string                          { return "" }
func (n NullConfiguration) GetConfigFilename() string                     { return "" }
func (n NullConfiguration) GetSessionFilename() string                    { return "" }
func (n NullConfiguration) GetDbFilename() string                         { return "" }
func (n NullConfiguration) GetUsername() string                           { return "" }
func (n NullConfiguration) GetEmail() string                              { return "" }
func (n NullConfiguration) GetProxy() string                              { return "" }
func (n NullConfiguration) GetGpgHome() string                            { return "" }
func (n NullConfiguration) GetBundledCA(h string) string                  { return "" }
func (n NullConfiguration) GetUserCacheSize() (int, bool)                 { return 0, false }
func (n NullConfiguration) GetProofCacheSize() (int, bool)                { return 0, false }
func (n NullConfiguration) GetProofCacheLongDur() (time.Duration, bool)   { return 0, false }
func (n NullConfiguration) GetProofCacheMediumDur() (time.Duration, bool) { return 0, false }
func (n NullConfiguration) GetProofCacheShortDur() (time.Duration, bool)  { return 0, false }
func (n NullConfiguration) GetMerkleKIDs() []string                       { return nil }
func (n NullConfiguration) GetPinentry() string                           { return "" }
func (n NullConfiguration) GetUID() (ret keybase1.UID)                    { return }
func (n NullConfiguration) GetGpg() string                                { return "" }
func (n NullConfiguration) GetGpgOptions() []string                       { return nil }
func (n NullConfiguration) GetGpgDisabled() (bool, bool)                  { return false, false }
func (n NullConfiguration) GetPGPFingerprint() *PGPFingerprint            { return nil }
func (n NullConfiguration) GetSecretKeyringTemplate() string              { return "" }
func (n NullConfiguration) GetSalt() []byte                               { return nil }
func (n NullConfiguration) GetSocketFile() string                         { return "" }
func (n NullConfiguration) GetPidFile() string                            { return "" }
func (n NullConfiguration) GetDaemonPort() (int, bool)                    { return 0, false }
func (n NullConfiguration) GetStandalone() (bool, bool)                   { return false, false }
func (n NullConfiguration) GetLocalRPCDebug() string                      { return "" }
func (n NullConfiguration) GetTimers() string                             { return "" }
func (n NullConfiguration) GetDeviceID() *DeviceID                        { return nil }
func (n NullConfiguration) GetProxyCACerts() ([]string, error)            { return nil, nil }
func (n NullConfiguration) GetAutoFork() (bool, bool)                     { return false, false }
func (n NullConfiguration) GetDevelMode() (bool, bool)                    { return false, false }
func (n NullConfiguration) GetNoAutoFork() (bool, bool)                   { return false, false }
func (n NullConfiguration) GetSplitLogOutput() (bool, bool)               { return false, false }
func (n NullConfiguration) GetLogFile() string                            { return "" }

func (n NullConfiguration) GetUserConfig() (*UserConfig, error)                    { return nil, nil }
func (n NullConfiguration) GetUserConfigForUsername(s string) (*UserConfig, error) { return nil, nil }
func (n NullConfiguration) GetGString(string) string                               { return "" }
func (n NullConfiguration) GetBool(string, bool) (bool, bool)                      { return false, false }

func (n NullConfiguration) GetAllUsernames() (string, []string, error) {
	return "", nil, nil
}

func (n NullConfiguration) GetDebug() (bool, bool) {
	return false, false
}
func (n NullConfiguration) GetPlainLogging() (bool, bool) {
	return false, false
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

func (n NullConfiguration) GetBoolAtPath(string) (bool, bool) {
	return false, false
}

func (n NullConfiguration) GetIntAtPath(string) (int, bool) {
	return 0, false
}

func (n NullConfiguration) GetNullAtPath(string) bool {
	return false
}

type TestParameters struct {
	ConfigFilename string
	Home           string
	ServerURI      string
	GPGHome        string
	GPGOptions     []string
	Debug          bool
	Devel          bool // Whether we are in Devel Mode
}

func (tp TestParameters) GetDebug() (bool, bool) {
	if tp.Debug {
		return true, true
	}
	return false, false
}

type Env struct {
	sync.RWMutex
	cmd        CommandLine
	config     ConfigReader
	homeFinder HomeFinder
	writer     ConfigWriter
	Test       TestParameters
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

func (e *Env) SetConfig(config ConfigReader) {
	e.Lock()
	defer e.Unlock()
	e.config = config
}

func (e *Env) SetConfigWriter(writer ConfigWriter) {
	e.Lock()
	defer e.Unlock()
	e.writer = writer
}

func NewEnv(cmd CommandLine, config ConfigReader) *Env {
	if cmd == nil {
		cmd = NullConfiguration{}
	}
	if config == nil {
		config = NullConfiguration{}
	}
	e := Env{cmd: cmd, config: config}

	dev := e.GetServerURI() == DevelServerURI

	e.homeFinder = NewHomeFinder("keybase",
		func() string { return e.getHomeFromCmdOrConfig() },
		dev)
	return &e
}

func (e *Env) getHomeFromCmdOrConfig() string {
	return e.GetString(
		func() string { return e.Test.Home },
		func() string { return e.cmd.GetHome() },
		func() string { return e.config.GetHome() },
	)
}

func (e *Env) GetHome() string                { return e.homeFinder.Home(false) }
func (e *Env) GetConfigDir() string           { return e.homeFinder.ConfigDir() }
func (e *Env) GetCacheDir() string            { return e.homeFinder.CacheDir() }
func (e *Env) GetDataDir() string             { return e.homeFinder.DataDir() }
func (e *Env) GetRuntimeDir() (string, error) { return e.homeFinder.RuntimeDir() }
func (e *Env) GetChdirDir() (string, error)   { return e.homeFinder.ChdirDir() }
func (e *Env) GetLogDir() string              { return e.homeFinder.LogDir() }

func (e *Env) getEnvInt(s string) (int, bool) {
	v := os.Getenv(s)
	if len(v) > 0 {
		tmp, err := strconv.ParseInt(v, 0, 64)
		if err != nil {
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

func (e *Env) getPGPFingerprint(flist ...(func() *PGPFingerprint)) *PGPFingerprint {
	for _, f := range flist {
		if ret := f(); ret != nil {
			return ret
		}
	}
	return nil
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

func (e *Env) GetServerURI() string {
	return e.GetString(
		func() string { return e.Test.ServerURI },
		func() string { return e.cmd.GetServerURI() },
		func() string { return os.Getenv("KEYBASE_SERVER_URI") },
		func() string { return e.config.GetServerURI() },
		func() string { return ServerURI },
	)
}

func (e *Env) GetConfigFilename() string {
	return e.GetString(
		func() string { return e.Test.ConfigFilename },
		func() string { return e.cmd.GetConfigFilename() },
		func() string { return os.Getenv("KEYBASE_CONFIG_FILE") },
		func() string { return e.config.GetConfigFilename() },
		func() string { return filepath.Join(e.GetConfigDir(), ConfigFile) },
	)
}

func (e *Env) GetSessionFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetSessionFilename() },
		func() string { return os.Getenv("KEYBASE_SESSION_FILE") },
		func() string { return e.config.GetSessionFilename() },
		func() string { return filepath.Join(e.GetCacheDir(), SessionFile) },
	)
}

func (e *Env) GetDbFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetDbFilename() },
		func() string { return os.Getenv("KEYBASE_DB_FILE") },
		func() string { return e.config.GetDbFilename() },
		func() string { return filepath.Join(e.GetDataDir(), DBFile) },
	)
}

func (e *Env) GetDebug() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.Test.GetDebug() },
		func() (bool, bool) { return e.cmd.GetDebug() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_DEBUG") },
		func() (bool, bool) { return e.config.GetDebug() },
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
				f:   func() (bool, bool) { return e.config.GetAutoFork() },
			},
		},
	)
}

func (e *Env) GetStandalone() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetStandalone() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_STANDALONE") },
		func() (bool, bool) { return e.config.GetStandalone() },
	)
}

func (e *Env) GetPlainLogging() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetPlainLogging() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_PLAIN_LOGGING") },
		func() (bool, bool) { return e.config.GetPlainLogging() },
	)
}

func (e *Env) GetAPIDump() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetAPIDump() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_API_DUMP") },
	)
}

func (e *Env) GetUsername() string {
	return e.config.GetUsername()
}

func (e *Env) GetSocketFile() (ret string, err error) {
	ret = e.GetString(
		func() string { return e.cmd.GetSocketFile() },
		func() string { return os.Getenv("KEYBASE_SOCKET_FILE") },
		func() string { return e.config.GetSocketFile() },
	)
	if len(ret) == 0 {
		var d string
		d, err = e.GetRuntimeDir()
		if err == nil {
			ret = filepath.Join(d, SocketFile)
		}
	}
	return
}

func (e *Env) GetPidFile() (ret string, err error) {
	ret = e.GetString(
		func() string { return e.cmd.GetPidFile() },
		func() string { return os.Getenv("KEYBASE_PID_FILE") },
		func() string { return e.config.GetPidFile() },
	)
	if len(ret) == 0 {
		var d string
		d, err = e.GetRuntimeDir()
		if err == nil {
			ret = filepath.Join(d, PIDFile)
		}
	}
	return
}

func (e *Env) GetDaemonPort() int {
	return e.GetInt(0,
		func() (int, bool) { return e.cmd.GetDaemonPort() },
		func() (int, bool) { return e.getEnvInt("KEYBASE_DAEMON_PORT") },
		func() (int, bool) { return e.config.GetDaemonPort() },
	)
}

func (e *Env) GetEmail() string {
	return e.GetString(
		func() string { return os.Getenv("KEYBASE_EMAIL") },
	)
}

func (e *Env) GetProxy() string {
	return e.GetString(
		func() string { return e.cmd.GetProxy() },
		func() string { return os.Getenv("https_proxy") },
		func() string { return os.Getenv("http_proxy") },
		func() string { return e.config.GetProxy() },
	)
}

func (e *Env) GetGpgHome() string {
	return e.GetString(
		func() string { return e.Test.GPGHome },
		func() string { return e.cmd.GetGpgHome() },
		func() string { return os.Getenv("GNUPGHOME") },
		func() string { return e.config.GetGpgHome() },
		func() string { return filepath.Join(e.GetHome(), ".gnupg") },
	)
}

func (e *Env) GetPinentry() string {
	return e.GetString(
		func() string { return e.cmd.GetPinentry() },
		func() string { return os.Getenv("KEYBASE_PINENTRY") },
		func() string { return e.config.GetPinentry() },
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
		func() (bool, bool) { return e.config.GetNoPinentry() },
	)
}

func (e *Env) GetBundledCA(host string) string {
	return e.GetString(
		func() string { return e.config.GetBundledCA(host) },
		func() string {
			ret, ok := BundledCAs[host]
			if !ok {
				ret = ""
			}
			return ret
		},
	)
}

func (e *Env) GetUserCacheSize() int {
	return e.GetInt(UserCacheSize,
		func() (int, bool) { return e.cmd.GetUserCacheSize() },
		func() (int, bool) { return e.getEnvInt("KEYBASE_USER_CACHE_SIZE") },
		func() (int, bool) { return e.config.GetUserCacheSize() },
	)
}

func (e *Env) GetProofCacheSize() int {
	return e.GetInt(ProofCacheSize,
		e.cmd.GetProofCacheSize,
		func() (int, bool) { return e.getEnvInt("KEYBASE_PROOF_CACHE_SIZE") },
		e.config.GetProofCacheSize,
	)
}

func (e *Env) GetProofCacheLongDur() time.Duration {
	return e.GetDuration(ProofCacheLongDur,
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_PROOF_CACHE_LONG_DUR") },
		e.config.GetProofCacheLongDur,
	)
}

func (e *Env) GetProofCacheMediumDur() time.Duration {
	return e.GetDuration(ProofCacheMediumDur,
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_PROOF_CACHE_MEDIUM_DUR") },
		e.config.GetProofCacheMediumDur,
	)
}

func (e *Env) GetProofCacheShortDur() time.Duration {
	return e.GetDuration(ProofCacheShortDur,
		func() (time.Duration, bool) { return e.getEnvDuration("KEYBASE_PROOF_CACHE_SHORT_DUR") },
		e.config.GetProofCacheShortDur,
	)
}

func (e *Env) GetEmailOrUsername() string {
	un := e.GetUsername()
	if len(un) > 0 {
		return un
	}
	em := e.GetEmail()
	return em
}

func (e *Env) GetDevelMode() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetDevelMode() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_DEVEL_MODE") },
		func() (bool, bool) { return e.config.GetDevelMode() },
		func() (bool, bool) {
			if e.Test.Devel || e.GetServerURI() == DevelServerURI {
				return true, true
			}
			return false, false
		},
	)
}

func (e *Env) GetUID() keybase1.UID { return e.config.GetUID() }

func (e *Env) GetStringList(list ...(func() []string)) []string {
	for _, f := range list {
		if res := f(); res != nil {
			return res
		}
	}
	return []string{}
}

func (e *Env) GetMerkleKIDs() []KID {
	slist := e.GetStringList(
		func() []string { return e.cmd.GetMerkleKIDs() },
		func() []string { return e.getEnvPath("KEYBASE_MERKLE_KIDS") },
		func() []string { return e.config.GetMerkleKIDs() },
		func() []string {
			ret := MerkleProdKIDs
			if e.GetDevelMode() {
				ret = append(ret, MerkleTestKIDs...)
			}
			return ret
		},
	)

	if slist == nil {
		return nil
	}
	var ret []KID
	for _, s := range slist {
		kid, err := ImportKID(s)
		if err != nil {
			G.Log.Warning("Skipping bad Merkle KID: %s", s)
			continue
		}

		ret = append(ret, kid)
	}

	return ret
}

func (e *Env) GetGpg() string {
	return e.GetString(
		func() string { return e.cmd.GetGpg() },
		func() string { return os.Getenv("GPG") },
		func() string { return e.config.GetGpg() },
	)
}

func (e *Env) GetGpgOptions() []string {
	return e.GetStringList(
		func() []string { return e.Test.GPGOptions },
		func() []string { return e.cmd.GetGpgOptions() },
		func() []string { return e.config.GetGpgOptions() },
	)
}

func (e *Env) GetGpgDisabled() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetGpgDisabled() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_GPG_DISABLED") },
		func() (bool, bool) { return e.config.GetGpgDisabled() },
	)
}

func (e *Env) GetSecretKeyringTemplate() string {
	return e.GetString(
		func() string { return e.cmd.GetSecretKeyringTemplate() },
		func() string { return os.Getenv("KEYBASE_SECRET_KEYRING_TEMPLATE") },
		func() string { return e.config.GetSecretKeyringTemplate() },
		func() string { return filepath.Join(e.GetConfigDir(), SecretKeyringTemplate) },
	)
}

func (e *Env) GetSalt() []byte {
	return e.config.GetSalt()
}

func (e *Env) GetLocalRPCDebug() string {
	return e.GetString(
		func() string { return e.cmd.GetLocalRPCDebug() },
		func() string { return os.Getenv("KEYBASE_LOCAL_RPC_DEBUG") },
		func() string { return e.config.GetLocalRPCDebug() },
	)
}

func (e *Env) GetTimers() string {
	return e.GetString(
		func() string { return e.cmd.GetTimers() },
		func() string { return os.Getenv("KEYBASE_TIMERS") },
		func() string { return e.config.GetTimers() },
	)
}

func (e *Env) GetDeviceID() (ret *DeviceID) {
	return e.config.GetDeviceID()
}

func (e *Env) GetSplitLogOutput() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetSplitLogOutput() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_SPLIT_LOG_OUTPUT") },
		func() (bool, bool) { return e.config.GetSplitLogOutput() },
	)
}

func (e *Env) GetLogFile() string {
	return e.GetString(
		func() string { return e.cmd.GetLogFile() },
		func() string { return os.Getenv("KEYBASE_LOG_FILE") },
		func() string { return e.config.GetLogFile() },
		func() string { return filepath.Join(e.GetLogDir(), "keybase.log") },
	)
}
