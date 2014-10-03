
package libkb

import (
)

type Global struct {
	Env *Env
	LoginState LoginState
	Log *Logger
	Keyrings *Keyrings
}

var G Global = Global { nil, LoginState { false, false, false }, NewDefaultLogger(), nil }

func (g *Global) SetCommandLine (cmd CommandLine) { g.Env.SetCommandLine(cmd) }

func (g *Global) Init() { g.Env = NewEnv(nil,nil) }

func (g *Global) ConfigureLogging() {g.Log.Configure(g.Env) }

func (g *Global) ConfigureConfig() {
	c := NewJsonConfigFile(g.Env.GetConfigFilename())
	err := c.Load(true)
	if err != nil {
		g.Log.Fatalf("Failed to open config file: %s\n", err.Error())
	}
	g.Env.SetConfig(*c)
}

func (g *Global) ConfigureKeyring() {
	c := NewKeyrings(*g.Env)
	err := c.Load()
	if err != nil {
		g.Log.Fatalf("Failed to configure keyrings: %s", err.Error())
	}
	g.Keyrings = c
}

func (g Global) StartupMessage() {
	VersionMessage(func(s string) { g.Log.Debug(s); })
}
