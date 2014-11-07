package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
	"regexp"
	"strings"
)

type CommandLine struct {
	app  *cli.App
	ctx  *cli.Context
	cmd  Command
	name string // the name of the chosen command
}

func (p CommandLine) GetHome() string {
	return p.GetGString("home")
}
func (p CommandLine) GetServerUri() string {
	return p.GetGString("server")
}
func (p CommandLine) GetConfigFilename() string {
	return p.GetGString("config")
}
func (p CommandLine) GetSessionFilename() string {
	return p.GetGString("session")
}
func (p CommandLine) GetDbFilename() string {
	return p.GetGString("db")
}
func (p CommandLine) GetDebug() (bool, bool) {
	return p.GetBool("debug", true)
}
func (p CommandLine) GetUsername() string {
	return p.GetGString("username")
}
func (p CommandLine) GetUid() *libkb.UID {
	if s := p.GetGString("uid"); len(s) == 0 {
		return nil
	} else if i, e := libkb.UidFromHex(s); e == nil {
		return i
	} else {
		return nil
	}
}
func (p CommandLine) GetEmail() string {
	return p.GetGString("email")
}
func (p CommandLine) GetProxy() string {
	return p.GetGString("proxy")
}
func (p CommandLine) GetPlainLogging() (bool, bool) {
	return p.GetBool("plain-logging", true)
}
func (p CommandLine) GetPgpDir() string {
	return p.GetGString("pgpdir")
}
func (p CommandLine) GetApiDump() (bool, bool) {
	return p.GetBool("api-dump", true)
}
func (p CommandLine) GetPinentry() string {
	return p.GetGString("pinentry")
}
func (p CommandLine) GetGString(s string) string {
	return p.ctx.GlobalString(s)
}
func (p CommandLine) GetGInt(s string) int {
	return p.ctx.GlobalInt(s)
}
func (p CommandLine) GetGpg() string {
	return p.GetGString("gpg")
}
func (p CommandLine) GetGpgOptions() []string {
	var ret []string
	s := p.GetGString("gpg-options")
	if len(s) > 0 {
		ret = regexp.MustCompile(`\s+`).Split(s, -1)
	}
	return ret
}
func (p CommandLine) GetMerkleKeyFingerprints() []string {
	s := p.GetGString("merkle-key-fingerprints")
	if len(s) != 0 {
		return strings.Split(s, ":")
	} else {
		return nil
	}
}
func (p CommandLine) GetUserCacheSize() (int, bool) {
	ret := p.GetGInt("user-cache-size")
	if ret != 0 {
		return ret, true
	} else {
		return 0, false
	}
}
func (p CommandLine) GetProofCacheSize() (int, bool) {
	ret := p.GetGInt("proof-cache-size")
	if ret != 0 {
		return ret, true
	} else {
		return 0, false
	}
}

func (p CommandLine) GetBool(s string, glbl bool) (bool, bool) {
	var v bool
	if glbl {
		v = p.ctx.GlobalBool(s)
	} else {
		v = p.ctx.Bool(s)
	}
	return v, v
}

type CmdBaseHelp struct {
	ctx *cli.Context
}

func (c *CmdBaseHelp) UseConfig() bool              { return false }
func (c *CmdBaseHelp) UseKeyring() bool             { return false }
func (c *CmdBaseHelp) UseAPI() bool                 { return false }
func (c *CmdBaseHelp) UseTerminal() bool            { return false }
func (c *CmdBaseHelp) ParseArgv(*cli.Context) error { return nil }

type CmdGeneralHelp struct {
	CmdBaseHelp
}

func (c *CmdBaseHelp) Run() error {
	cli.ShowAppHelp(c.ctx)
	return nil
}

type CmdSpecificHelp struct {
	CmdBaseHelp
	name string
}

func (c CmdSpecificHelp) Run() error {
	cli.ShowCommandHelp(c.ctx, c.name)
	return nil
}

func NewCommandLine() *CommandLine {
	app := cli.NewApp()
	ret := &CommandLine{app: app}
	ret.PopulateApp()
	return ret
}

func (cl *CommandLine) PopulateApp() {
	app := cl.app
	app.Name = "keybase"
	app.Version = libkb.CLIENT_VERSION
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
			Name : "uid, i",
			Usage : "specify Keybase UID for current user",
		},
		cli.StringFlag{
			Name:  "pinentry",
			Usage: "specify a path to find a pinentry program",
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
		cli.IntFlag{
			Name:  "user-cache-size",
			Usage: "number of User entries to cache",
		},
		cli.IntFlag{
			Name:  "proof-cache-size",
			Usage: "number of proof entries to cache",
		},
		cli.StringFlag{
			Name:  "gpg",
			Usage: "Path to GPG client (optional for exporting keys)",
		},
		cli.StringFlag{
			Name:  "gpg-options",
			Usage: "Options to use when calling GPG",
		},
	}

	app.Commands = []cli.Command{
		NewCmdConfig(cl),
		NewCmdDb(cl),
		NewCmdId(cl),
		NewCmdLogin(cl),
		NewCmdLogout(cl),
		NewCmdPing(cl),
		NewCmdResolve(cl),
		NewCmdSigs(cl),
		NewCmdSign(cl),
		NewCmdTrack(cl),
		NewCmdVersion(cl),
	}

	// Finally, add a default help action...
	app.Action = func(c *cli.Context) {
		cl.cmd = &CmdGeneralHelp{CmdBaseHelp{c}}
		cl.ctx = c
		cl.name = "help"
	}
}

// Called back from inside our subcommands, when they're picked...
func (p *CommandLine) ChooseCommand(cmd Command, name string, ctx *cli.Context) {
	p.cmd = cmd
	p.name = name
	p.ctx = ctx
}

func (p *CommandLine) Parse(args []string) (cmd Command, err error) {

	// Actually pick a command
	err = p.app.Run(args)

	// Should not be populated
	cmd = p.cmd

	if err != nil || cmd == nil {
		return
	}

	// If we failed to parse arguments properly, switch to the help command
	if err = p.cmd.ParseArgv(p.ctx); err != nil {
		G.Log.Error("In '%s': %s", p.name, err.Error())
		cmd = &CmdSpecificHelp{CmdBaseHelp{p.ctx}, p.name}
	}

	return
}
