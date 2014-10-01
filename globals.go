
package libkb

import (
)

type Global struct {
	Env *Env
	LoginState LoginState
	Log *Logger
}

var G Global = Global { nil, LoginState { false, false, false }, NewDefaultLogger() }

func (g *Global) SetCommandLine (cmd CommandLine) { g.Env.SetCommandLine(cmd) }
func (g *Global) Init() { g.Env = NewEnv(nil,nil) }
func (g *Global) ConfigureLogging() {g.Log.Configure(g.Env) }
