package libkb

import (
	"github.com/codegangsta/cli"
	"strings"
)

type PosixCommandLine struct {
	app *cli.App
	ctx *cli.Context
}

func (p PosixCommandLine) GetHome() string {
	return p.GetGString("home")
}
func (p PosixCommandLine) GetServerUri() string {
	return p.GetGString("server")
}
func (p PosixCommandLine) GetConfigFilename() string {
	return p.GetGString("config")
}
func (p PosixCommandLine) GetSessionFilename() string {
	return p.GetGString("session")
}
func (p PosixCommandLine) GetDbFilename() string {
	return p.GetGString("db")
}
func (p PosixCommandLine) GetDebug() (bool, bool) {
	return p.GetBool("debug", true)
}
func (p PosixCommandLine) GetUsername() string {
	return p.GetGString("username")
}
func (p PosixCommandLine) GetEmail() string {
	return p.GetGString("email")
}
func (p PosixCommandLine) GetProxy() string {
	return p.GetGString("proxy")
}
func (p PosixCommandLine) GetPlainLogging() (bool, bool) {
	return p.GetBool("plain-logging", true)
}
func (p PosixCommandLine) GetPgpDir() string {
	return p.GetGString("pgpdir")
}
func (p PosixCommandLine) GetApiDump() (bool, bool) {
	return p.GetBool("api-dump", true)
}
func (p PosixCommandLine) GetGString(s string) string {
	return p.ctx.GlobalString(s)
}
func (p PosixCommandLine) GetGInt(s string) int {
	return p.ctx.GlobalInt(s)
}
func (p PosixCommandLine) GetMerkleKeyFingerprints() []string {
	s := p.GetGString("merkle-key-fingerprints")
	if len(s) != 0 {
		return strings.Split(s, ":")
	} else {
		return nil
	}
}
func (p PosixCommandLine) GetUserCacheSize() (int, bool) {
	ret := p.GetGInt("user-cache-size")
	if ret != 0 {
		return ret, true
	} else {
		return 0, false
	}
}

func (p PosixCommandLine) GetBool(s string, glbl bool) (bool, bool) {
	var v bool
	if glbl {
		v = p.ctx.GlobalBool(s)
	} else {
		v = p.ctx.Bool(s)
	}
	return v, v
}

type CmdHelp struct {
	ctx *cli.Context
}

func (c *CmdHelp) UseConfig() bool   { return false }
func (c *CmdHelp) UseKeyring() bool  { return false }
func (c *CmdHelp) UseAPI() bool      { return false }
func (c *CmdHelp) UseTerminal() bool { return false }
func (c *CmdHelp) Run() error {
	cli.ShowAppHelp(c.ctx)
	return nil
}
func (c *CmdHelp) Initialize(*cli.Context) error { return nil }

type CmdCommandHelp struct {
	CmdHelp
	name string
}

func (c CmdCommandHelp) Run() error {
	cli.ShowCommandHelp(c.ctx, c.name)
	return nil
}

func (p *PosixCommandLine) InitSubcommand(c *cli.Context,
	cmd Command, name string) Command {
	p.ctx = c
	if err := cmd.Initialize(c); err != nil {
		G.Log.Error("In '%s': %s", name, err.Error())
		cmd = &CmdCommandHelp{CmdHelp{c}, name}
	}
	return cmd
}

func (p *PosixCommandLine) Parse(args []string) (Command, error) {
	var cmd Command
	app := cli.NewApp()
	app.Name = "keybase"
	app.Version = CLIENT_VERSION
	app.Usage = "control keybase either with 1-off commands, " +
		"or start a daemon"
	app.Flags = []cli.Flag{
		cli.StringFlag{
			Name:  "home, H",
			Usage: "specify an (alternate) home directory",
		},
		cli.StringFlag{
			Name: "server, s",
			Usage: "specify server API " +
				"(default: https://api.keybase.io:443/)",
		},
		cli.StringFlag{
			Name:  "config, c",
			Usage: "specify an (alternate) master config file",
		},
		cli.StringFlag{
			Name:  "session",
			Usage: "specify an alternate session data file",
		},
		cli.StringFlag{
			Name:  "db",
			Usage: "specify an alternate local DB location",
		},
		cli.StringFlag{
			Name:  "api-uri-path-prefix",
			Usage: "specify an alternate API URI path prefix",
		},
		cli.StringFlag{
			Name:  "username, u",
			Usage: "specify Keybase username of the current user",
		},
		cli.StringFlag{
			Name: "proxy",
			Usage: "specify an HTTP(s) proxy to ship all Web " +
				"requests over",
		},
		cli.BoolFlag{
			Name:  "debug, d",
			Usage: "enable debugging mode",
		},
		cli.BoolFlag{
			Name:  "plain-logging, L",
			Usage: "plain logging mode (no colors)",
		},
		cli.StringFlag{
			Name:  "pgpdir, gpgdir",
			Usage: "specify a PGP directory (default is ~/.gnupg)",
		},
		cli.BoolFlag{
			Name:  "api-dump",
			Usage: "dump API call internals",
		},
		cli.StringFlag{
			Name:  "merkle-key-fingerprints",
			Usage: "Set of admissable Merkle Tree fingerprints (colon-separated)",
		},
	}
	app.Commands = []cli.Command{
		{
			Name:  "version",
			Usage: "print out version information",
			Action: func(c *cli.Context) {
				p.ctx = c
				cmd = &CmdVersion{}
			},
		},
		{
			Name:  "ping",
			Usage: "ping the keybase API server",
			Action: func(c *cli.Context) {
				p.ctx = c
				cmd = &CmdPing{}
			},
		},
		{
			Name:  "config",
			Usage: "manage key/value pairs in the config file",
			Description: "A single argument reads a key; " +
				"two arguments set a key/value pair",
			Flags: []cli.Flag{
				cli.BoolFlag{
					Name:  "location, l",
					Usage: "print config file location",
				},
				cli.BoolFlag{
					Name:  "reset, r",
					Usage: "clear entire existing config",
				},
				cli.BoolFlag{
					Name:  "clear, c",
					Usage: "delete a key",
				},
			},
			Action: func(c *cli.Context) {
				cmd = p.InitSubcommand(c, &CmdConfig{}, "config")
			},
		},
		{
			Name:        "db",
			Usage:       "keybase db [subcommands...]",
			Description: "Manipulate the local Keybase DB",
			Subcommands: []cli.Command{
				{
					Name:        "cache",
					Usage:       "keybase db cache <username>",
					Description: "Load, verify, and cache a user",
					Action: func(c *cli.Context) {
						cmd = p.InitSubcommand(c, &CmdDbCache{}, "cache")
					},
				},
				{
					Name:        "nuke",
					Usage:       "keybase db nuke",
					Description: "Delete the local DB cache",
					Action: func(c *cli.Context) {
						p.ctx = c
						cmd = &CmdDbNuke{c}
					},
					Flags: []cli.Flag{
						cli.BoolFlag{
							Name:  "force, f",
							Usage: "Force nuking; don't prompt",
						},
					},
				},
			},
		},
		{
			Name:        "sigs",
			Usage:       "keybase sigs [subcommands...]",
			Description: "List, revoke signatures",
			Subcommands: []cli.Command{
				{
					Name:  "list",
					Usage: "keybase sigs list [filter]",
					Action: func(c *cli.Context) {
						cmd = p.InitSubcommand(c, &CmdSigsList{}, "list")
					},
					Flags: []cli.Flag{
						cli.BoolFlag{
							Name:  "r, revoked",
							Usage: "Show revoked signatures",
						},
						cli.BoolFlag{
							Name:  "j, json",
							Usage: "output in json format; default is text",
						},
						cli.BoolFlag{
							Name:  "v, verbose",
							Usage: "a full dump, with more gory detail",
						},
						cli.StringFlag{
							Name: "t, type",
							Usage: "type of sig to output; choose from {track" +
								", proof, cryptocurrency, self}; all by default",
						},
						cli.BoolFlag{
							Name:  "a, all-keys",
							Usage: "show signatures from all (replaced) keys",
						},
						cli.BoolFlag{
							Name:  "H, headers",
							Usage: "show column headers",
						},
						cli.StringFlag{
							Name:  "f, filter",
							Usage: "provide a regex filter",
						},
					},
				},
			},
		},
		{
			Name: "login",
			Usage: "Establish a session with the keybase server " +
				"(if necessary)",
			Action: func(c *cli.Context) {
				p.ctx = c
				cmd = &CmdLogin{}
			},
		},
		{
			Name:  "resolve",
			Usage: "Resolve a foo@bar-style username to a keybase username",
			Action: func(c *cli.Context) {
				cmd = p.InitSubcommand(c, &CmdResolve{}, "resolve")
			},
		},
	}
	app.Action = func(c *cli.Context) {
		p.ctx = c
		cmd = &CmdHelp{c}
	}
	p.app = app
	err := app.Run(args)
	return cmd, err
}
