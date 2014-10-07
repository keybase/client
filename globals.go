package libkb

import (
	"fmt"
)

type Global struct {
	Log        *Logger
	Session    *Session
	LoginState *LoginState
	Env        *Env
	Keyrings   *Keyrings
	API        *ApiAccess
	Terminal   Terminal
	RunMode    *RunMode
}

var G Global = Global{
	NewDefaultLogger(),
	nil,
	nil,
	nil,
	nil,
	nil,
	nil,
	nil,
}

func (g *Global) SetCommandLine(cmd CommandLine) { g.Env.SetCommandLine(cmd) }

func (g *Global) Init() {
	g.Env = NewEnv(nil, nil)
	g.LoginState = NewLoginState()
	g.Session = NewSession()
}

func (g *Global) ConfigureLogging() error {
	g.Log.Configure(g.Env)
	return nil
}

func (g *Global) ConfigureConfig() error {
	c := NewJsonConfigFile(g.Env.GetConfigFilename())
	err := c.Load(true)
	if err != nil {
		return fmt.Errorf("Failed to open config file: %s\n", err.Error())
	}
	g.Env.SetConfig(*c)
	g.Env.SetConfigAdjuster(*NewJsonConfigAdjuster(c))
	return nil
}

func (g *Global) ConfigureKeyring() error {
	c := NewKeyrings(*g.Env)
	err := c.Load()
	if err != nil {
		return fmt.Errorf("Failed to configure keyrings: %s", err.Error())
	}
	g.Keyrings = c
	return nil
}

func (g Global) StartupMessage() {
	VersionMessage(func(s string) { g.Log.Debug(s) })
}

func (g *Global) ConfigureAPI() error {
	api, err := NewApiAccess(*g.Env)
	if err != nil {
		return fmt.Errorf("Failed to configure API access: %s", err.Error())
	}
	g.API = api
	return nil
}

func (g *Global) ConfigureTerminal() error {
	g.Terminal = NewTerminalImplementation()
	return nil
}

func (g *Global) ConfigureRunMode() error {
	g.RunMode = NewRunMode()

	// Disable this for background daemons.
	g.RunMode.HasTerminal = true

	return nil
}

func (g *Global) Shutdown() error {
	var err error
	if g.Terminal != nil {
		tmp := g.Terminal.Shutdown()
		if tmp != nil && err == nil {
			err = tmp
		}
	}
	return err
}
