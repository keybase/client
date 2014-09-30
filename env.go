
package libkbgo

import (
	"os"
	"strconv"
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

func (e Env) GetConfigDir() (ret string, err error) {return e.homeFinder.ConfigDir() }
func (e Env) GetCacheDir() (ret string, err error) {return e.homeFinder.CacheDir() }
func (e Env) GetDataDir() (ret string, err error) {return e.homeFinder.DataDir() }

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

func (e Env) GetPort() int64 {
	i := e.cmd.GetPort()
	if i < 0 { i = e.config.GetPort() }
	if i < 0 { i = e.getEnvInt("KEYBASE_PORT") }
	if i < 0 { i = int64(PORT) }
	return i
}
