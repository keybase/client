package libcmdline

import (
	"io"
	"regexp"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libkb"
)

type Command interface {
	libkb.Command
	ParseArgv(*cli.Context) error // A command-specific parse-args
	Run() error                   // Run in client mode
}

type ForkCmd int

const (
	NormalFork ForkCmd = iota
	NoFork
	ForceFork
)

type CommandLine struct {
	app          *cli.App
	ctx          *cli.Context
	cmd          Command
	name         string  // the name of the chosen command
	service      bool    // The server is a special command
	fork         ForkCmd // If the command is to stop (then don't start the server)
	noStandalone bool    // On if this command can't run in standalone mode
	defaultCmd   string
}

func (p CommandLine) IsService() bool       { return p.service }
func (p *CommandLine) SetService()          { p.service = true }
func (p CommandLine) GetForkCmd() ForkCmd   { return p.fork }
func (p *CommandLine) SetForkCmd(v ForkCmd) { p.fork = v }
func (p *CommandLine) SetNoStandalone()     { p.noStandalone = true }
func (p CommandLine) IsNoStandalone() bool  { return p.noStandalone }

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
func (p CommandLine) GetServerURI() string {
	return p.GetGString("server")
}
func (p CommandLine) GetConfigFilename() string {
	return p.GetGString("config-file")
}
func (p CommandLine) GetSessionFilename() string {
	return p.GetGString("session-file")
}
func (p CommandLine) GetDbFilename() string {
	return p.GetGString("db")
}
func (p CommandLine) GetDebug() (bool, bool) {
	return p.GetBool("debug", true)
}
func (p CommandLine) GetPGPFingerprint() *libkb.PGPFingerprint {
	return libkb.PGPFingerprintFromHexNoError(p.GetGString("fingerprint"))
}
func (p CommandLine) GetProxy() string {
	return p.GetGString("proxy")
}
func (p CommandLine) GetUsername() libkb.NormalizedUsername {
	return libkb.NewNormalizedUsername(p.GetGString("username"))
}
func (p CommandLine) GetLogFormat() string {
	return p.GetGString("log-format")
}
func (p CommandLine) GetLabel() string {
	return p.GetGString("label")
}
func (p CommandLine) GetGpgHome() string {
	return p.GetGString("gpg-home")
}
func (p CommandLine) GetAPIDump() (bool, bool) {
	return p.GetBool("api-dump-unsafe", true)
}
func (p CommandLine) GetRunMode() (libkb.RunMode, error) {
	return libkb.StringToRunMode(p.GetGString("run-mode"))
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

func (p CommandLine) GetMerkleKIDs() []string {
	s := p.GetGString("merkle-kids")
	if len(s) != 0 {
		return strings.Split(s, ":")
	}
	return nil
}
func (p CommandLine) GetUserCacheSize() (int, bool) {
	ret := p.GetGInt("user-cache-size")
	if ret != 0 {
		return ret, true
	}
	return 0, false
}
func (p CommandLine) GetProofCacheSize() (int, bool) {
	ret := p.GetGInt("proof-cache-size")
	if ret != 0 {
		return ret, true
	}
	return 0, false
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

func (p CommandLine) GetLocalRPCDebug() string {
	return p.GetGString("local-rpc-debug-unsafe")
}

func (p CommandLine) GetTimers() string {
	return p.GetGString("timers")
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

func NewCommandLine(addHelp bool, extraFlags []cli.Flag) *CommandLine {
	app := cli.NewApp()
	ret := &CommandLine{app: app, fork: NormalFork}
	ret.PopulateApp(addHelp, extraFlags)
	return ret
}

func (p *CommandLine) PopulateApp(addHelp bool, extraFlags []cli.Flag) {
	app := p.app
	app.Name = "keybase"
	app.Version = libkb.Version
	app.Usage = "Keybase command line client."

	app.Flags = []cli.Flag{
		cli.StringFlag{
			Name:  "home, H",
			Usage: "Specify an (alternate) home directory.",
		},
		cli.StringFlag{
			Name:  "server, s",
			Usage: "Specify server API.",
		},
		cli.StringFlag{
			Name:  "config-file, c",
			Usage: "Specify an (alternate) master config file.",
		},
		cli.StringFlag{
			Name:  "session-file",
			Usage: "Specify an alternate session data file.",
		},
		cli.StringFlag{
			Name:  "db",
			Usage: "Specify an alternate local DB location.",
		},
		cli.StringFlag{
			Name:  "api-uri-path-prefix",
			Usage: "Specify an alternate API URI path prefix.",
		},
		cli.StringFlag{
			Name:  "username, u",
			Usage: "Specify Keybase username of the current user.",
		},
		cli.StringFlag{
			Name:  "pinentry",
			Usage: "Specify a path to find a pinentry program.",
		},
		cli.StringFlag{
			Name:  "secret-keyring",
			Usage: "Location of the Keybase secret-keyring (P3SKB-encoded).",
		},
		cli.StringFlag{
			Name:  "socket-file",
			Usage: "Location of the keybased socket-file.",
		},
		cli.StringFlag{
			Name:  "pid-file",
			Usage: "Location of the keybased pid-file (to ensure only one running daemon).",
		},
		cli.StringFlag{
			Name:  "proxy",
			Usage: "Specify an HTTP(s) proxy to ship all Web requests over.",
		},
		cli.BoolFlag{
			Name:  "debug, d",
			Usage: "Enable debugging mode.",
		},
		cli.StringFlag{
			Name:  "run-mode",
			Usage: "Run mode (devel, staging, prod).", // These are defined in libkb/constants.go
		},
		cli.StringFlag{
			Name:  "log-format",
			Usage: "Log format (default, plain, file, fancy).",
		},
		cli.StringFlag{
			Name:  "label",
			Usage: "Specifying a label can help identify services.",
		},
		cli.StringFlag{
			Name:  "pgpdir, gpgdir",
			Usage: "Specify a PGP directory (default is ~/.gnupg).",
		},
		cli.BoolFlag{
			Name:  "api-dump-unsafe",
			Usage: "Dump API call internals (may leak secrets).",
		},
		cli.StringFlag{
			Name:  "merkle-key-fingerprints",
			Usage: "Set of admissable Merkle Tree fingerprints (colon-separated).",
		},
		cli.IntFlag{
			Name:  "user-cache-size",
			Usage: "Number of User entries to cache.",
		},
		cli.IntFlag{
			Name:  "proof-cache-size",
			Usage: "Number of proof entries to cache.",
		},
		cli.StringFlag{
			Name:  "gpg",
			Usage: "Path to GPG client (optional for exporting keys).",
		},
		cli.StringFlag{
			Name:  "gpg-options",
			Usage: "Options to use when calling GPG.",
		},
		cli.IntFlag{
			Name:  "daemon-port",
			Usage: "Specify a daemon port on 127.0.0.1.",
		},
		cli.BoolFlag{
			Name:  "standalone",
			Usage: "Use the client without any daemon support.",
		},
		cli.StringFlag{
			Name:  "local-rpc-debug-unsafe",
			Usage: "Use to debug local RPC (may leak secrets).",
		},
		cli.StringFlag{
			Name:  "log-file",
			Usage: "Specify a log file for the keybase service.",
		},
		cli.BoolFlag{
			Name:  "split-log-output",
			Usage: "Output service log messages to current terminal.",
		},
		cli.StringFlag{
			Name:  "timers",
			Usage: "specify 'a' for API; 'r' for RPCs; and 'x' for eXternal API calls",
		},
	}
	if extraFlags != nil {
		app.Flags = append(app.Flags, extraFlags...)
	}

	// Finally, add help if we asked for it
	if addHelp {
		app.Action = func(c *cli.Context) {
			p.cmd = &CmdGeneralHelp{CmdBaseHelp{c}}
			p.ctx = c
			p.name = "help"
		}
	}
	app.Commands = []cli.Command{}
}

func filter(cmds []cli.Command, fn func(cli.Command) bool) []cli.Command {
	var filter []cli.Command
	for _, cmd := range cmds {
		if fn(cmd) {
			filter = append(filter, cmd)
		}
	}
	return filter
}

func (p *CommandLine) AddCommands(cmds []cli.Command) {
	cmds = filter(cmds, func(c cli.Command) bool {
		return c.Name != ""
	})
	p.app.Commands = append(p.app.Commands, cmds...)
}

func (p *CommandLine) SetDefaultCommand(name string, cmd Command) {
	p.defaultCmd = name
	p.app.Action = func(c *cli.Context) {
		p.cmd = cmd
		p.ctx = c
		p.name = name
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
	if err = p.cmd.ParseArgv(p.ctx); err == nil {
		_, err = p.GetRunMode()
	}
	if err != nil {
		cmd = &CmdSpecificHelp{CmdBaseHelp{p.ctx}, p.name}
	}

	return
}

func (p *CommandLine) SetOutputWriter(w io.Writer) {
	p.app.Writer = w
}
