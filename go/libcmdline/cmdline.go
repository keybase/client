package libcmdline

import (
	"fmt"
	"regexp"
	"strings"
	"text/tabwriter"
	"text/template"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libkb"
)

type Command interface {
	libkb.Command
	ParseArgv(*cli.Context) error // A command-specific parse-args
	Run() error                   // Actually run the command (finally!)
	RunClient() error             // Run in client mode
}

type ForkCmd int

const (
	NormalFork ForkCmd = iota
	NoFork
	ForceFork
)

type CommandLine struct {
	app        *cli.App
	ctx        *cli.Context
	cmd        Command
	name       string  // the name of the chosen command
	service    bool    // The server is a special command
	fork       ForkCmd // If the command is to stop (then don't start the server)
	defaultCmd string
}

func (cl CommandLine) IsService() bool       { return cl.service }
func (cl *CommandLine) SetService()          { cl.service = true }
func (cl CommandLine) GetForkCmd() ForkCmd   { return cl.fork }
func (cl *CommandLine) SetForkCmd(v ForkCmd) { cl.fork = v }

func (p CommandLine) GetSplitLogOutput() (bool, bool) {
	return p.GetBool("split-log-output", true)
}
func (p CommandLine) GetLogFile() string {
	return p.GetGString("log-file")
}
func (p CommandLine) GetNoAutoFork() (bool, bool) {
	return p.GetBool("no-auto-fork", true)
}
func (p CommandLine) GetAutoFork() (bool, bool) {
	return p.GetBool("auto-fork", true)
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
func (p CommandLine) GetPgpFingerprint() *libkb.PgpFingerprint {
	return libkb.PgpFingerprintFromHexNoError(p.GetGString("fingerprint"))
}
func (p CommandLine) GetProxy() string {
	return p.GetGString("proxy")
}
func (p CommandLine) GetUsername() string {
	return p.GetGString("username")
}
func (p CommandLine) GetPlainLogging() (bool, bool) {
	return p.GetBool("plain-logging", true)
}
func (p CommandLine) GetGpgHome() string {
	return p.GetGString("gpg-home")
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
func (p CommandLine) GetSecretKeyringTemplate() string {
	return p.GetGString("secret-keyring")
}
func (p CommandLine) GetSocketFile() string {
	return p.GetGString("socket-file")
}
func (p CommandLine) GetPidFile() string {
	return p.GetGString("pid-file")
}
func (p CommandLine) GetGpgOptions() []string {
	var ret []string
	s := p.GetGString("gpg-options")
	if len(s) > 0 {
		ret = regexp.MustCompile(`\s+`).Split(s, -1)
	}
	return ret
}
func (p CommandLine) GetGpgDisabled() (bool, bool) {
	return p.GetBool("gpg-disabled", true)
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
func (p CommandLine) GetDaemonPort() (ret int, set bool) {
	if ret = p.GetGInt("daemon-port"); ret != 0 {
		set = true
	}
	return
}

func (p CommandLine) GetStandalone() (bool, bool) {
	return p.GetBool("standalone", true)
}

func (p CommandLine) GetLocalRpcDebug() string {
	return p.GetGString("local-rpc-debug")
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

func (c *CmdBaseHelp) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
func (c *CmdBaseHelp) ParseArgv(*cli.Context) error { return nil }

type CmdGeneralHelp struct {
	CmdBaseHelp
}

func (c *CmdBaseHelp) RunClient() error { return c.Run() }

// This is a hack to work around codegangsta/cli destroying the HelpPrinter
// object.
func (c *CmdBaseHelp) MakeHelpPrinter() {
	if cli.HelpPrinter != nil {
		return
	}
	funcMap := template.FuncMap{
		"join": strings.Join,
	}

	cli.HelpPrinter = func(templ string, data interface{}) {
		w := tabwriter.NewWriter(c.ctx.App.Writer, 0, 8, 1, '\t', 0)
		t := template.Must(template.New("help").Funcs(funcMap).Parse(templ))
		err := t.Execute(w, data)
		if err != nil {
			panic(err)
		}
		w.Flush()
	}
}

func (c *CmdBaseHelp) Run() error {
	c.MakeHelpPrinter()
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

func NewCommandLine(addHelp bool, extraFlags []cli.Flag) *CommandLine {
	app := cli.NewApp()
	ret := &CommandLine{app: app, fork: NormalFork}
	ret.PopulateApp(addHelp, extraFlags)
	return ret
}

func (cl *CommandLine) PopulateApp(addHelp bool, extraFlags []cli.Flag) {
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
			Name:  "server, s",
			Usage: fmt.Sprintf("specify server API (default: %s)", libkb.SERVER_URL),
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
			Name:  "uid, i",
			Usage: "specify Keybase UID for current user",
		},
		cli.StringFlag{
			Name:  "pinentry",
			Usage: "specify a path to find a pinentry program",
		},
		cli.StringFlag{
			Name:  "secret-keyring",
			Usage: "location of the Keybase secret-keyring (P3SKB-encoded)",
		},
		cli.StringFlag{
			Name:  "socket-file",
			Usage: "location of the keybased socket-file",
		},
		cli.StringFlag{
			Name:  "pid-file",
			Usage: "location of the keybased pid-file (to ensure only one running daemon)",
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
		cli.BoolFlag{
			Name:  "gpg-disabled",
			Usage: "Disable GPG support",
		},
		cli.IntFlag{
			Name:  "daemon-port",
			Usage: "specify a daemon port on 127.0.0.1",
		},
		cli.BoolFlag{
			Name:  "standalone",
			Usage: "use the client without any daemon support",
		},
		cli.StringFlag{
			Name:  "local-rpc-debug",
			Usage: "use to debug local RPC",
		},
		cli.StringFlag{
			Name:  "log-file",
			Usage: "specify a log file for the keybase service",
		},
		cli.BoolFlag{
			Name:  "split-log-output",
			Usage: "output service log messages to current terminal",
		},
	}
	if extraFlags != nil {
		app.Flags = append(app.Flags, extraFlags...)
	}

	// Finally, add help if we asked for it
	if addHelp {
		app.Action = func(c *cli.Context) {
			cl.cmd = &CmdGeneralHelp{CmdBaseHelp{c}}
			cl.ctx = c
			cl.name = "help"
		}
	}
	app.Commands = []cli.Command{}
}

func (cl *CommandLine) AddCommands(cmds []cli.Command) {
	cl.app.Commands = append(cl.app.Commands, cmds...)
}

func (cl *CommandLine) SetDefaultCommand(name string, cmd Command) {
	cl.defaultCmd = name
	cl.app.Action = func(c *cli.Context) {
		cl.cmd = cmd
		cl.ctx = c
		cl.name = name
	}
}

// Called back from inside our subcommands, when they're picked...
func (p *CommandLine) ChooseCommand(cmd Command, name string, ctx *cli.Context) {
	p.cmd = cmd
	p.name = name
	p.ctx = ctx
}

func (p *CommandLine) Parse(args []string) (cmd Command, err error) {
	// This is suboptimal, but the default help action when there are
	// no args crashes.
	// (cli sets HelpPrinter to nil when p.app.Run(...) returns.)
	if len(args) == 1 && p.defaultCmd == "help" {
		args = append(args, p.defaultCmd)
	}

	// Actually pick a command
	err = p.app.Run(args)

	// Should not be populated
	cmd = p.cmd

	if err != nil || cmd == nil {
		return
	}

	// cli.HelpPrinter is nil here...anything that needs it will panic.

	// If we failed to parse arguments properly, switch to the help command
	if err = p.cmd.ParseArgv(p.ctx); err != nil {
		libkb.G.Log.Errorf("In '%s': %s", p.name, err.Error())
		cmd = &CmdSpecificHelp{CmdBaseHelp{p.ctx}, p.name}
	}

	return
}
