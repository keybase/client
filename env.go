
package libkbgo

import (
	"os"
	"strconv"
	"path/filepath"
)

type Env struct {
	cmd CommandLine
	config Config
	homeFinder HomeFinder
}

func NewEnv(cmd CommandLine, config Config) Env {
	e := Env { cmd, config, nil }
	e.homeFinder = NewHomeFinder("keybase", func() string { return e.getHome() })
	return e
}

func (e Env) getHome() string {
	var ret string
	ret = e.cmd.GetHome()
	if len(ret) == 0 {ret = e.config.GetHome() }
	return ret
}

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

func (e Env) GetString(flist ...(func() string)) string {
	var ret string
	for _, f := range(flist) {
		ret = f()
		if len(ret) > 0 { break; }
	}
	return ret
}

func (e Env) GetServerUrl() string {
	return e.GetString(
		func() string { return e.cmd.GetServerUrl() },
		func() string { return e.config.GetServerUrl() },
		func() string { return os.Getenv("KEYBASE_SERVER_URL") },
		func() string { return KEYBASE_SERVER_URL },
	)
}

func (e Env) GetConfigFilename() string {
	return e.GetString(
		func() string { return e.cmd.GetConfigFilename() },
		func() string { return e.config.GetConfigFilename() },
		func() string { return os.Getenv("KEYBASE_CONFIG_FILE") },
		func() string { return filepath.Join(e.GetConfigDir(), KEYBASE_CONFIG_FILE) },
	)
}
