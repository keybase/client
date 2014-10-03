
package libkb

import (
	"os"
	"strconv"
	"path/filepath"
	"strings"
)

type NullConfiguration struct {}
func (n NullConfiguration) GetHome() string  { return "" }
func (n NullConfiguration) GetServerUri() string { return "" }
func (n NullConfiguration) GetConfigFilename() string { return "" }
func (n NullConfiguration) GetSessionFilename() string { return "" }
func (n NullConfiguration) GetDbFilename() string { return "" }
func (n NullConfiguration) GetApiUriPathPrefix() string { return "" }
func (n NullConfiguration) GetUsername() string { return "" }
func (n NullConfiguration) GetProxy() string { return "" }
func (n NullConfiguration) GetDebug() (bool, bool) { return false, false }
func (n NullConfiguration) GetPlainLogging() (bool, bool) { return false, false }
func (n NullConfiguration) GetPgpDir() string { return "" }
func (n NullConfiguration) GetBundledCA(h string) string { return "" }

type Env struct {
	cmd CommandLine
	config Config
	homeFinder HomeFinder
}

func (e *Env) SetCommandLine(cmd CommandLine) { e.cmd = cmd }
func (e *Env) SetConfig(config Config) { e.config = config }

func NewEnv(cmd CommandLine, config Config) *Env {
	if cmd == nil { cmd = NullConfiguration{} }
	if config == nil { config = NullConfiguration{} }
	e := Env { cmd, config, nil }
	e.homeFinder = NewHomeFinder("keybase", func() string { return e.getHomeFromCmdOrConfig() })
	return &e
}

func (e Env) getHomeFromCmdOrConfig() string {
	var ret string
	ret = e.cmd.GetHome()
	if len(ret) == 0 {ret = e.config.GetHome() }
	return ret
}

func (e Env) GetHome() string { return e.homeFinder.Home(false) }
func (e Env) GetConfigDir() string {return e.homeFinder.ConfigDir() }
func (e Env) GetCacheDir() string {return e.homeFinder.CacheDir() }
func (e Env) GetDataDir() string {return e.homeFinder.DataDir() }

func (e Env) getEnvInt(s string) (ret int64) {
	ret = -1
	v := os.Getenv(s)
	if len(v) > 0 {
		tmp, err := strconv.ParseInt(v, 0, 64)
		if err != nil {
			ret = tmp
		}
	}
	return ret
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
	for _, f := range(flist) {
		ret = f()
		if len(ret) > 0 { break; }
	}
	return ret
}

func (e Env) GetBool(def bool, flist ...func() (bool, bool)) bool {
	for _, f := range(flist) {
		if val, is_set := f(); is_set { return val }
	}
	return def
}

func (e Env) GetServerUri() string {
	return e.GetString(
		func() string { return e.cmd.GetServerUri() },
		func() string { return e.config.GetServerUri() },
		func() string { return os.Getenv("KEYBASE_SERVER_URI") },
		func() string { return SERVER_URL },
	)
}

func (e Env) GetConfigFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetConfigFilename() },
		func() string { return e.config.GetConfigFilename() },
		func() string { return os.Getenv("KEYBASE_CONFIG_FILE") },
		func() string { return filepath.Join(e.GetConfigDir(), CONFIG_FILE) },
	)
}

func (e Env) GetSessionFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetSessionFilename() },
		func() string { return e.config.GetSessionFilename() },
		func() string { return os.Getenv("KEYBASE_SESSION_FILE") },
		func() string { return filepath.Join(e.GetCacheDir(), SESSION_FILE) },
	)
}

func (e Env) GetDbFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetDbFilename() },
		func() string { return e.config.GetDbFilename() },
		func() string { return os.Getenv("KEYBASE_DB_FILE") },
		func() string { return filepath.Join(e.GetDataDir(), SESSION_FILE) },
	)
}

func (e Env) GetDebug() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetDebug() },
		func() (bool, bool) { return e.config.GetDebug() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_DEBUG") },
	)
}

func (e Env) GetPlainLogging() bool {
	return e.GetBool(false,
		func() (bool, bool) { return e.cmd.GetPlainLogging() },
		func() (bool, bool) { return e.config.GetPlainLogging() },
		func() (bool, bool) { return e.getEnvBool("KEYBASE_PLAIN_LOGGING") },
	)
}


func (e Env) GetApiUriPathPrefix() string {
	return e.GetString(
		func() string { return e.cmd.GetApiUriPathPrefix() },
		func() string { return e.config.GetApiUriPathPrefix() },
		func() string { return os.Getenv("KEYBASE_API_URI_PATH_PREFIX") },
		func() string { return API_URI_PATH_PREFIX },
	)
}

func (e Env) GetUsername() string {
	return e.GetString(
		func() string { return e.cmd.GetUsername() },
		func() string { return e.config.GetUsername() },
		func() string { return os.Getenv("KEYBASE_USERNAME") },
	)
}

func (e Env) GetProxy() string {
	return e.GetString(
		func() string { return e.cmd.GetProxy() },
		func() string { return e.config.GetProxy() },
		func() string { return os.Getenv("https_proxy") },
		func() string { return os.Getenv("http_proxy") },
	)
}

func (e Env) GetPgpDir() string {
	return e.GetString(
		func() string { return e.cmd.GetPgpDir() },
		func() string { return e.config.GetPgpDir() },
		func() string { return os.Getenv("GNUPGHOME") },
		func() string { return filepath.Join(e.GetHome(), ".gnupg") },
	)
}

func (e Env) GetPublicKeyrings() []string {
	return []string{ filepath.Join(e.GetPgpDir(), "pubring.gpg") }
}

func (e Env) GetSecretKeyrings() []string {
	return []string{ filepath.Join(e.GetPgpDir(), "secring.gpg") }
}

func (e Env) GetBundledCA(host string) string {
	return e.GetString(
		func() string { return e.config.GetBundledCA(host) },
		func() string { 
			ret, ok := BundledCAs[host]
			if !ok { ret = "" }
			return ret
		},
	)	
}
