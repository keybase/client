//
// globals
//
//   All of the global objects in the libkb namespace that are shared
//   and mutated across various source files are here.  They are
//   accessed like `G.Session` or `G.LoginState`.  They're kept
//   under the `G` namespace to better keep track of them all.
//
//   The globals are built up gradually as the process comes up.
//   At first, we only have a logger, but eventually we add
//   command-line flags, configuration and environment, and accordingly,
//   might actually go back and change the Logger.

package libkb

import (
	"fmt"
)

type Global struct {
	Log           *Logger       // Handles all logging
	Session       *Session      // The user's session cookie, &c
	SessionWriter SessionWriter // To write the session back out
	LoginState    *LoginState   // What phase of login the user's in
	Env           *Env          // Env variables, cmdline args & config
	Keyrings      *Keyrings     // Gpg Keychains holding keys
	API           *ApiAccess    // How to make a REST call to the server
	Terminal      Terminal      // For prompting for passwords and input
	UserCache     *UserCache    // LRU cache of users in memory
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
	nil,
}

func (g *Global) SetCommandLine(cmd CommandLine) { g.Env.SetCommandLine(cmd) }

func (g *Global) Init() {
	g.Env = NewEnv(nil, nil)
	g.LoginState = NewLoginState()
	g.Session = NewSession()
	g.SessionWriter = g.Session
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
	g.Env.SetConfigWriter(c)
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

func (g *Global) ConfigureCaches() (err error) {
	g.UserCache, err = NewUserCache(g.Env.GetUserCacheSize())
	return
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
