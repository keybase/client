
package libkb

import (
)

type Global struct {
	Env *Env
	LoginState LoginState
	Log *Logger
	Keychains *Keychains
}

var G Global = Global { nil, LoginState { false, false, false }, NewDefaultLogger(), nil }

func (g *Global) SetCommandLine (cmd CommandLine) { g.Env.SetCommandLine(cmd) }

func (g *Global) Init() { g.Env = NewEnv(nil,nil) }

func (g *Global) ConfigureLogging() {g.Log.Configure(g.Env) }

func (g *Global) ConfigureConfig() {
	c := NewJsonConfigFile(g.Env.GetConfigFilename())
	err := c.Load()
	if err != nil {
		g.Log.Fatalf("Failed to open config file: %s\n", err.Error())
	}
	g.Env.SetConfig(*c)
}

func (g *Global) ConfigureKeychains() {
	c := NewKeychains(*g.Env)
	err := c.Load()
	if err != nil {
		g.Log.Fatalf("Failed to configure keychains: %s", err.Error())
	}
	g.Keychains = c
}
