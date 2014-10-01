
package libkbgo

import (
	"log"
)

type Global struct {
	Env *Env
	LoginState LoginState
	Log *log.Logger
}

func (g *Global) SetCommandLine (cmd CommandLine) { g.Env.SetCommandLine(cmd) }
func (g *Global) SetLogger(l *log.Logger) { g.Log = l }

func InitGlobals() { G.Env = NewEnv(nil,nil) }

var G Global = Global { nil, LoginState { false, false, false }, NewDefaultLogger() }
