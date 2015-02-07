package libkb

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type NullConfiguration struct{}

func (n NullConfiguration) GetHome() string                    { return "" }
func (n NullConfiguration) GetServerUri() string               { return "" }
func (n NullConfiguration) GetConfigFilename() string          { return "" }
func (n NullConfiguration) GetSessionFilename() string         { return "" }
func (n NullConfiguration) GetDbFilename() string              { return "" }
func (n NullConfiguration) GetUsername() string                { return "" }
func (n NullConfiguration) GetEmail() string                   { return "" }
func (n NullConfiguration) GetProxy() string                   { return "" }
func (n NullConfiguration) GetPgpDir() string                  { return "" }
func (n NullConfiguration) GetBundledCA(h string) string       { return "" }
func (n NullConfiguration) GetUserCacheSize() (int, bool)      { return 0, false }
func (n NullConfiguration) GetProofCacheSize() (int, bool)     { return 0, false }
func (n NullConfiguration) GetMerkleKeyFingerprints() []string { return nil }
func (n NullConfiguration) GetPinentry() string                { return "" }
func (n NullConfiguration) GetUID() *UID                       { return nil }
func (n NullConfiguration) GetVerifiedUID() *UID               { return nil }
func (n NullConfiguration) GetGpg() string                     { return "" }
func (n NullConfiguration) GetGpgOptions() []string            { return nil }
func (n NullConfiguration) GetPgpFingerprint() *PgpFingerprint { return nil }
func (n NullConfiguration) GetSecretKeyring() string           { return "" }
func (n NullConfiguration) GetSalt() []byte                    { return nil }
func (n NullConfiguration) GetSocketFile() string              { return "" }
func (n NullConfiguration) GetDaemonPort() (int, bool)         { return 0, false }
func (n NullConfiguration) GetStandalone() (bool, bool)        { return false, false }
func (n NullConfiguration) GetLocalRpcDebug() string           { return "" }
func (n NullConfiguration) GetDeviceID() *DeviceID             { return nil }

func (n NullConfiguration) GetUserConfig() (*UserConfig, error)                    { return nil, nil }
func (n NullConfiguration) GetUserConfigForUsername(s string) (*UserConfig, error) { return nil, nil }

func (n NullConfiguration) GetDebug() (bool, bool) {
	return false, false
}
func (n NullConfiguration) GetPlainLogging() (bool, bool) {
	return false, false
}
func (n NullConfiguration) GetApiDump() (bool, bool) {
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
	ServerUri      string
	GPGHome        string
	GPGOptions     []string
}

type Env struct {
	cmd        CommandLine
	config     ConfigReader
	homeFinder HomeFinder
	writer     ConfigWriter
	Test       TestParameters
}

func (e *Env) GetConfig() ConfigReader       { return e.config }
func (e *Env) GetConfigWriter() ConfigWriter { return e.writer }

func (e *Env) SetCommandLine(cmd CommandLine) { e.cmd = cmd }
func (e *Env) GetCommandLine() CommandLine    { return e.cmd }
func (e *Env) SetConfig(config ConfigReader)  { e.config = config }
func (e *Env) SetConfigWriter(writer ConfigWriter) {
	e.writer = writer
}

func NewEnv(cmd CommandLine, config ConfigReader) *Env {
	if cmd == nil {
		cmd = NullConfiguration{}
	}
	if config == nil {
		config = NullConfiguration{}
	}
	e := Env{cmd, config, nil, nil, TestParameters{}}
	e.homeFinder = NewHomeFinder("keybase",
		func() string { return e.getHomeFromCmdOrConfig() })
	return &e
}

func (e Env) getHomeFromCmdOrConfig() string {
	return e.GetString(
		func() string { return e.Test.Home },
		func() string { return e.cmd.GetHome() },
		func() string { return e.config.GetHome() },
	)
}

func (e Env) GetHome() string                { return e.homeFinder.Home(false) }
func (e Env) GetConfigDir() string           { return e.homeFinder.ConfigDir() }
func (e Env) GetCacheDir() string            { return e.homeFinder.CacheDir() }
func (e Env) GetDataDir() string             { return e.homeFinder.DataDir() }
func (e Env) GetRuntimeDir() (string, error) { return e.homeFinder.RuntimeDir() }

func (e Env) getEnvInt(s string) (int, bool) {
	v := os.Getenv(s)
	if len(v) > 0 {
		tmp, err := strconv.ParseInt(v, 0, 64)
		if err != nil {
			return int(tmp), true
		}
	}
	return 0, false
}

func (e Env) getEnvPath(s string) []string {
	if tmp := os.Getenv(s); len(tmp) == 0 {
		return nil
	} else {
		return strings.Split(tmp, ":")
	}
}

func (e Env) getEnvBool(s string) (bool, bool) {
	tmp := os.Getenv(s)
	if len(tmp) == 0 {
		return false, false
	} else {
		tmp = strings.ToLower(tmp)
		if tmp == "0" || tmp[0] == byte('n') {
			return false, true
		} else {
			return true, true
		}
	}
}

func (e Env) GetString(flist ...(func() string)) string {
	var ret string
	for _, f := range flist {
		ret = f()
		if len(ret) > 0 {
			break
		}
	}
	return ret
}

func (e Env) getPgpFingerprint(flist ...(func() *PgpFingerprint)) *PgpFingerprint {
	for _, f := range flist {
		if ret := f(); ret != nil {
			return ret
		}
	}
	return nil
}

func (e Env) GetBool(def bool, flist ...func() (bool, bool)) bool {
	for _, f := range flist {
		if val, is_set := f(); is_set {
			return val
		}
	}
	return def
}

func (e Env) GetInt(def int, flist ...func() (int, bool)) int {
	for _, f := range flist {
		if val, is_set := f(); is_set {
			return val
		}
	}
	return def
}

func (e Env) GetServerUri() string {
	return e.GetString(
		func() string { return e.Test.ServerUri },
		func() string { return e.cmd.GetServerUri() },
		func() string { return os.Getenv("KEYBASE_SERVER_URI") },
		func() string { return e.config.GetServerUri() },
		func() string { return SERVER_URL },
	)
}

func (e Env) GetConfigFilename() string {
	return e.GetString(
		func() string { return e.Test.ConfigFilename },
		func() string { return e.cmd.GetConfigFilename() },
		func() string { return os.Getenv("KEYBASE_CONFIG_FILE") },
		func() string { return e.config.GetConfigFilename() },
		func() string { return filepath.Join(e.GetConfigDir(), CONFIG_FILE) },
	)
}

func (e Env) GetSessionFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetSessionFilename() },
		func() string { return os.Getenv("KEYBASE_SESSION_FILE") },
		func() string { return e.config.GetSessionFilename() },
		func() string { return filepath.Join(e.GetCacheDir(), SESSION_FILE) },
	)
}

func (e Env) GetDbFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetDbFilename() },
		func() string { return os.Getenv("KEYBASE_DB_FILE") },
		func() string { return e.config.GetDbFilename() },
		func() string { return filepath.Join(e.GetDataDir(), DB_FILE) },
	)
}

func (e Env) GetDebug() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetDebug() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_DEBUG") },
		func() (bool, bool) { return e.config.GetDebug() },
	)
}

func (e Env) GetStandalone() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetStandalone() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_STANDALONE") },
		func() (bool, bool) { return e.config.GetStandalone() },
	)
}

func (e Env) GetPlainLogging() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetPlainLogging() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_PLAIN_LOGGING") },
		func() (bool, bool) { return e.config.GetPlainLogging() },
	)
}

func (e Env) GetApiDump() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetApiDump() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_API_DUMP") },
	)
}

func (e Env) GetUsername() string {
	return e.config.GetUsername()
}

func (e Env) GetSocketFile() (ret string, err error) {
	ret = e.GetString(
		func() string { return e.cmd.GetSocketFile() },
		func() string { return os.Getenv("KEYBASE_SOCKET_FILE") },
		func() string { return e.config.GetSocketFile() },
	)
	if len(ret) == 0 {
		var d string
		d, err = e.GetRuntimeDir()
		if err == nil {
			ret = filepath.Join(d, SOCKET_FILE)
		}
	}
	return
}

func (e Env) GetDaemonPort() int {
	return e.GetInt(0,
		func() (int, bool) { return e.cmd.GetDaemonPort() },
		func() (int, bool) { return e.getEnvInt("KEYBASE_DAEMON_PORT") },
		func() (int, bool) { return e.config.GetDaemonPort() },
	)
}

func (e Env) GetEmail() string {
	return e.GetString(
		func() string { return e.cmd.GetEmail() },
		func() string { return os.Getenv("KEYBASE_EMAIL") },
	)
}

func (e Env) GetProxy() string {
	return e.GetString(
		func() string { return e.cmd.GetProxy() },
		func() string { return os.Getenv("https_proxy") },
		func() string { return os.Getenv("http_proxy") },
		func() string { return e.config.GetProxy() },
	)
}

func (e Env) GetPgpDir() string {
	return e.GetString(
		func() string { return e.Test.GPGHome },
		func() string { return e.cmd.GetPgpDir() },
		func() string { return os.Getenv("GNUPGHOME") },
		func() string { return e.config.GetPgpDir() },
		func() string { return filepath.Join(e.GetHome(), ".gnupg") },
	)
}

func (e Env) GetPinentry() string {
	return e.GetString(
		func() string { return e.cmd.GetPinentry() },
		func() string { return os.Getenv("KEYBASE_PINENTRY") },
		func() string { return e.config.GetPinentry() },
	)
}

func (e Env) GetNoPinentry() bool {

	isno := func(s string) (bool, bool) {
		s = strings.ToLower(s)
		if s == "0" || s == "no" || s == "n" || s == "none" {
			return true, true
		} else {
			return false, false
		}
	}

	return e.GetBool(false,
		func() (bool, bool) { return isno(e.cmd.GetPinentry()) },
		func() (bool, bool) { return isno(os.Getenv("KEYBASE_PINENTRY")) },
		func() (bool, bool) { return e.config.GetNoPinentry() },
	)
}

func (e Env) GetPublicKeyrings() []string {
	return []string{filepath.Join(e.GetPgpDir(), "pubring.gpg")}
}

func (e Env) GetPgpSecretKeyrings() []string {
	return []string{filepath.Join(e.GetPgpDir(), "secring.gpg")}
}

func (e Env) GetBundledCA(host string) string {
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

func (e Env) GetUserCacheSize() int {
	return e.GetInt(USER_CACHE_SIZE,
		func() (int, bool) { return e.cmd.GetUserCacheSize() },
		func() (int, bool) { return e.getEnvInt("KEYBASE_USER_CACHE_SIZE") },
		func() (int, bool) { return e.config.GetUserCacheSize() },
	)
}

func (e Env) GetProofCacheSize() int {
	return e.GetInt(PROOF_CACHE_SIZE,
		func() (int, bool) { return e.cmd.GetProofCacheSize() },
		func() (int, bool) { return e.getEnvInt("KEYBASE_PROOF_CACHE_SIZE") },
		func() (int, bool) { return e.config.GetProofCacheSize() },
	)
}

func (e Env) GetEmailOrUsername() string {
	un := e.GetUsername()
	if len(un) > 0 {
		return un
	}
	em := e.GetEmail()
	return em
}

// XXX implement me
func (e Env) GetTestMode() bool {
	return false
}

func (e Env) GetUID() *UID         { return e.config.GetUID() }
func (e Env) GetVerifiedUID() *UID { return e.config.GetVerifiedUID() }

func (e Env) GetStringList(list ...(func() []string)) []string {
	for _, f := range list {
		if res := f(); res != nil {
			return res
		}
	}
	return []string{}
}

func (e Env) GetMerkleKeyFingerprints() []PgpFingerprint {
	slist := e.GetStringList(
		func() []string { return e.cmd.GetMerkleKeyFingerprints() },
		func() []string { return e.getEnvPath("KEYBASE_MERKLE_KEY_FINGERPRINTS") },
		func() []string { return e.config.GetMerkleKeyFingerprints() },
		func() []string {
			if e.GetTestMode() {
				return []string{MERKLE_TEST_KEY}
			} else {
				return []string{MERKLE_PROD_KEY}
			}
		},
	)

	if slist == nil {
		return nil
	}
	ret := make([]PgpFingerprint, 0, len(slist))
	for _, s := range slist {
		fp, err := PgpFingerprintFromHex(s)
		if err != nil {
			G.Log.Warning("Skipping bad Merkle fingerprint: %s", s)
		} else {
			ret = append(ret, *fp)
		}
	}

	return ret
}

func (e Env) GetGpg() string {
	return e.GetString(
		func() string { return e.cmd.GetGpg() },
		func() string { return os.Getenv("GPG") },
		func() string { return e.config.GetGpg() },
	)
}

func (e Env) GetGpgOptions() []string {
	return e.GetStringList(
		func() []string { return e.Test.GPGOptions },
		func() []string { return e.cmd.GetGpgOptions() },
		func() []string { return e.config.GetGpgOptions() },
	)
}

func (e Env) GetSecretKeyring() string {
	return e.GetString(
		func() string { return e.cmd.GetSecretKeyring() },
		func() string { return os.Getenv("KEYBASE_SECRET_KEYRING") },
		func() string { return e.config.GetSecretKeyring() },
		func() string { return filepath.Join(e.GetConfigDir(), SECRET_KEYRING) },
	)
}

func (e Env) GetSalt() []byte {
	return e.config.GetSalt()
}

func (e Env) GetLocalRpcDebug() string {
	return e.GetString(
		func() string { return e.cmd.GetLocalRpcDebug() },
		func() string { return os.Getenv("KEYBASE_LOCAL_RPC_DEBUG") },
		func() string { return e.config.GetLocalRpcDebug() },
	)
}

func (e Env) GetDeviceID() (ret *DeviceID) {
	return e.config.GetDeviceID()
}
