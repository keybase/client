package libkb

import (
	"fmt"
)

type CmdConfig struct {
	location bool
	reset    bool
	key      string
	value    string
}

func (v CmdConfig) Run() error {
	configFile := G.Env.GetConfigFilename()
	if v.location {
		G.Log.Info(fmt.Sprintf("Using config file %s", configFile))
	}

	if v.reset {
		// clear out file
		cw := G.Env.GetConfigWriter()
		cw.Reset()
		cw.Write()
		// continue on to get or set on cleared file
	}

	// TODO: validate user input?

	if v.key != "" {
		if v.value != "" {
			cw := G.Env.GetConfigWriter()
			cw.SetStringAtPath(v.key, v.value)
			cw.Write()
		} else {
			if s, is_set := (*G.Env.GetConfig()).GetStringAtPath(v.key); is_set {
				G.Log.Info(fmt.Sprintf("%s: %s", v.key, s))
			} else {
				G.Log.Info(fmt.Sprintf("%s does not map to a value", v.key))
			}
		}
	}

	return nil
}

func (v CmdConfig) UseConfig() bool   { return true }
func (v CmdConfig) UseKeyring() bool  { return false }
func (v CmdConfig) UseAPI() bool      { return false }
func (v CmdConfig) UseTerminal() bool { return false }
