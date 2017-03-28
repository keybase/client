// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libcmdline

import (
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libkb"
)

type Command interface {
	libkb.Command
	ParseArgv(*cli.Context) error // A command-specific parse-args
	Run() error                   // Run in client mode
}

type ForkCmd int
type LogForward int

const (
	NormalFork ForkCmd = iota
	NoFork
	ForceFork
)

const (
	LogForwardNormal LogForward = iota
	LogForwardNone
)

type CommandLine struct {
	app                *cli.App
	ctx                *cli.Context
	cmd                Command
	name               string     // the name of the chosen command
	service            bool       // The server is a special command
	fork               ForkCmd    // If the command is to stop (then don't start the server)
	noStandalone       bool       // On if this command can't run in standalone mode
	logForward         LogForward // What do to about log forwarding
	skipOutOfDateCheck bool       // don't try to check for service being out of date
	defaultCmd         string
}

func (p CommandLine) IsService() bool             { return p.service }
func (p CommandLine) SkipOutOfDateCheck() bool    { return p.skipOutOfDateCheck }
func (p *CommandLine) SetService()                { p.service = true }
func (p CommandLine) GetForkCmd() ForkCmd         { return p.fork }
func (p *CommandLine) SetForkCmd(v ForkCmd)       { p.fork = v }
func (p *CommandLine) SetNoStandalone()           { p.noStandalone = true }
func (p CommandLine) IsNoStandalone() bool        { return p.noStandalone }
func (p *CommandLine) SetLogForward(f LogForward) { p.logForward = f }
func (p *CommandLine) GetLogForward() LogForward  { return p.logForward }
func (p *CommandLine) SetSkipOutOfDateCheck()     { p.skipOutOfDateCheck = true }

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
func (p CommandLine) GetUpdaterConfigFilename() string {
	return p.GetGString("updater-config-file")
}
func (p CommandLine) GetSessionFilename() string {
	return p.GetGString("session-file")
}
func (p CommandLine) GetDbFilename() string {
	return p.GetGString("db")
}
func (p CommandLine) GetChatDbFilename() string {
	return p.GetGString("chat-db")
}
func (p CommandLine) GetPvlKitFilename() string {
	return p.GetGString("pvl-kit")
}
func (p CommandLine) GetDebug() (bool, bool) {
	// --no-debug suppresses --debug. Note that although we don't define a
	// separate GetNoDebug() accessor, fork_server.go still looks for
	// --no-debug by name, to pass it along to an autoforked daemon.
	if noDebug, _ := p.GetBool("no-debug", true); noDebug {
		return false /* val */, true /* isSet */
	}
	return p.GetBool("debug", true)
}
func (p CommandLine) GetVDebugSetting() string {
	return p.GetGString("vdebug")
}
func (p CommandLine) GetPGPFingerprint() *libkb.PGPFingerprint {
	return libkb.PGPFingerprintFromHexNoError(p.GetGString("fingerprint"))
}
func (p CommandLine) GetProxy() string {
	return p.GetGString("proxy")
}
func (p CommandLine) GetLogFile() string {
	return p.GetGString("log-file")
}
func (p CommandLine) GetLogFormat() string {
	return p.GetGString("log-format")
}
func (p CommandLine) GetGpgHome() string {
	return p.GetGString("gpg-home")
}
func (p CommandLine) GetAPIDump() (bool, bool) {
	return p.GetBool("api-dump-unsafe", true)
}
func (p CommandLine) GetGregorSaveInterval() (time.Duration, bool) {
	ret, err := p.GetGDuration("push-save-interval")
	if err != nil {
		return 0, false
	}
	return ret, true
}
func (p CommandLine) GetGregorDisabled() (bool, bool) {
	return p.GetBool("push-disabled", true)
}
func (p CommandLine) GetBGIdentifierDisabled() (bool, bool) {
	return p.GetBool("bg-identifier-disabled", true)
}

func (p CommandLine) GetGregorURI() string {
	return p.GetGString("push-server-uri")
}
func (p CommandLine) GetGregorPingInterval() (time.Duration, bool) {
	ret, err := p.GetGDuration("push-ping-interval")
	if err != nil {
		return 0, false
	}
	return ret, true
}
func (p CommandLine) GetGregorPingTimeout() (time.Duration, bool) {
	ret, err := p.GetGDuration("push-ping-timeout")
	if err != nil {
		return 0, false
	}
	return ret, true
}

func (p CommandLine) GetChatDelivererInterval() (time.Duration, bool) {
	ret, err := p.GetGDuration("chat-deliverer-interval")
	if err != nil {
		return 0, false
	}
	return ret, true
}

func (p CommandLine) GetRunMode() (libkb.RunMode, error) {
	return libkb.StringToRunMode(p.GetGString("run-mode"))
}
func (p CommandLine) GetFeatureFlags() (libkb.FeatureFlags, error) {
	return libkb.StringToFeatureFlags(p.GetGString("features")), nil
}
func (p CommandLine) GetPinentry() string {
	return p.GetGString("pinentry")
}
func (p CommandLine) GetAppType() libkb.AppType {
	return libkb.DesktopAppType
}
func (p CommandLine) GetGString(s string) string {
	return p.ctx.GlobalString(s)
}
func (p CommandLine) GetString(s string) string {
	return p.ctx.String(s)
}
func (p CommandLine) GetGInt(s string) int {
	return p.ctx.GlobalInt(s)
}
func (p CommandLine) GetGDuration(s string) (time.Duration, error) {
	return time.ParseDuration(p.GetGString(s))
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
func (p CommandLine) GetScraperTimeout() (time.Duration, bool) {
	ret, err := p.GetGDuration("scraper-timeout")
	if err != nil {
		return 0, false
	}
	return ret, true
}
func (p CommandLine) GetAPITimeout() (time.Duration, bool) {
	ret, err := p.GetGDuration("api-timeout")
	if err != nil {
		return 0, false
	}
	return ret, true
}
func (p CommandLine) GetGpgOptions() []string {
	var ret []string
	s := p.GetGString("gpg-options")
	if len(s) > 0 {
		ret = strings.Fields(s)
	}
	return ret
}

func (p CommandLine) getKIDs(name string) []string {
	s := p.GetGString(name)
	if len(s) == 0 {
		return nil
	}
	return strings.Split(s, ":")
}

func (p CommandLine) GetMerkleKIDs() []string {
	return p.getKIDs("merkle-kids")
}

func (p CommandLine) GetCodeSigningKIDs() []string {
	return p.getKIDs("code-signing-kids")
}

func (p CommandLine) GetUserCacheMaxAge() (time.Duration, bool) {
	ret, err := p.GetGDuration("user-cache-maxage")
	if err != nil {
		return 0, false
	}
	return ret, true
}

func (p CommandLine) GetProofCacheSize() (int, bool) {
	ret := p.GetGInt("proof-cache-size")
	if ret != 0 {
		return ret, true
	}
	return 0, false
}

func (p CommandLine) GetLinkCacheSize() (int, bool) {
	ret := p.GetGInt("link-cache-size")
	if ret != 0 {
		return ret, true
	}
	return 0, false
}

func (p CommandLine) GetLocalTrackMaxAge() (time.Duration, bool) {
	ret, err := p.GetGDuration("local-track-maxage")
	if err != nil {
		return 0, false
	}
	return ret, true
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

func (p CommandLine) GetTorMode() (ret libkb.TorMode, err error) {
	if s := p.GetGString("tor-mode"); s != "" {
		ret, err = libkb.StringToTorMode(s)
	}
	return ret, err
}

func (p CommandLine) GetTorHiddenAddress() string {
	return p.GetGString("tor-hidden-address")
}
func (p CommandLine) GetTorProxy() string {
	return p.GetGString("tor-proxy")
}

func (p CommandLine) GetMountDir() string {
	return p.GetGString("mountdir")
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
	app.Version = libkb.VersionString()
	app.Usage = "Keybase command line client."

	app.Flags = []cli.Flag{
		cli.BoolFlag{
			Name:  "api-dump-unsafe",
			Usage: "Dump API call internals (may leak secrets).",
		},
		cli.StringFlag{
			Name:  "api-timeout",
			Usage: "set the HTTP timeout for API calls to the keybase API server",
		},
		cli.StringFlag{
			Name:  "api-uri-path-prefix",
			Usage: "Specify an alternate API URI path prefix.",
		},
		cli.StringFlag{
			Name:  "app-start-mode",
			Usage: "Specify 'service' to auto-start UI app, or anything else to disable",
		},
		cli.StringFlag{
			Name:  "code-signing-kids",
			Usage: "Set of code signing key IDs (colon-separated).",
		},
		cli.StringFlag{
			Name:  "config-file, c",
			Usage: "Specify an (alternate) master config file.",
		},
		cli.StringFlag{
			Name:  "db",
			Usage: "Specify an alternate local DB location.",
		},
		cli.StringFlag{
			Name:  "chat-db",
			Usage: "Specify an alternate local Chat DB location.",
		},
		cli.StringFlag{
			Name:  "pvl-kit",
			Usage: "Specify an alternate local PVL kit file location.",
		},
		cli.BoolFlag{
			Name:  "debug, d",
			Usage: "Enable debugging mode.",
		},
		cli.StringFlag{
			Name:  "features",
			Usage: "specify experimental feature flags",
		},
		cli.StringFlag{
			Name:  "gpg",
			Usage: "Path to GPG client (optional for exporting keys).",
		},
		cli.StringFlag{
			Name:  "gpg-options",
			Usage: "Options to use when calling GPG.",
		},
		cli.StringFlag{
			Name:  "home, H",
			Usage: "Specify an (alternate) home directory.",
		},
		cli.StringFlag{
			Name:  "local-rpc-debug-unsafe",
			Usage: "Use to debug local RPC (may leak secrets).",
		},
		cli.StringFlag{
			Name:  "log-file",
			Usage: "Specify a log file for the keybase service.",
		},
		cli.StringFlag{
			Name:  "log-format",
			Usage: "Log format (default, plain, file, fancy).",
		},
		cli.StringFlag{
			Name:  "merkle-kids",
			Usage: "Set of admissable Merkle Tree fingerprints (colon-separated).",
		},
		cli.BoolFlag{
			Name:  "no-debug",
			Usage: "Suppress debugging mode; takes precedence over --debug.",
		},
		cli.StringFlag{
			Name:  "pgpdir, gpgdir",
			Usage: "Specify a PGP directory (default is ~/.gnupg).",
		},
		cli.StringFlag{
			Name:  "pinentry",
			Usage: "Specify a path to find a pinentry program.",
		},
		cli.StringFlag{
			Name:  "pid-file",
			Usage: "Location of the keybased pid-file (to ensure only one running daemon).",
		},
		cli.IntFlag{
			Name:  "proof-cache-size",
			Usage: "Number of proof entries to cache.",
		},
		cli.StringFlag{
			Name:  "proxy",
			Usage: "Specify an HTTP(s) proxy to ship all Web requests over.",
		},
		cli.BoolFlag{
			Name:  "push-disabled",
			Usage: "Disable push server connection (which is on by default)",
		},
		cli.IntFlag{
			Name:  "push-save-interval",
			Usage: "Set the interval between saves of the push cache (in seconds)",
		},
		cli.StringFlag{
			Name:  "push-server-uri",
			Usage: "Specify a URI for contacting the Keybase push server",
		},
		cli.StringFlag{
			Name:  "run-mode",
			Usage: "Run mode (devel, staging, prod).", // These are defined in libkb/constants.go
		},
		cli.StringFlag{
			Name:  "scraper-timeout",
			Usage: "set the HTTP timeout for external proof scrapers",
		},
		cli.StringFlag{
			Name:  "secret-keyring",
			Usage: "Location of the Keybase secret-keyring (P3SKB-encoded).",
		},
		cli.StringFlag{
			Name:  "server, s",
			Usage: "Specify server API.",
		},
		cli.StringFlag{
			Name:  "session-file",
			Usage: "Specify an alternate session data file.",
		},
		cli.StringFlag{
			Name:  "socket-file",
			Usage: "Location of the keybased socket-file.",
		},
		cli.BoolFlag{
			Name:  "standalone",
			Usage: "Use the client without any daemon support.",
		},
		cli.StringFlag{
			Name:  "timers",
			Usage: "Specify 'a' for API; 'r' for RPCs; and 'x' for eXternal API calls",
		},
		cli.StringFlag{
			Name:  "tor-hidden-address",
			Usage: fmt.Sprintf("set TOR address of keybase server; defaults to %s", libkb.TorServerURI),
		},
		cli.StringFlag{
			Name:  "tor-mode",
			Usage: "set TOR mode to be 'leaky', 'none', or 'strict'. 'none' by default. See 'help tor' for more details.",
		},
		cli.StringFlag{
			Name:  "tor-proxy",
			Usage: fmt.Sprintf("set TOR proxy; when Tor mode is on; defaults to %s when TOR is enabled", libkb.TorProxy),
		},
		cli.StringFlag{
			Name:  "updater-config-file",
			Usage: "Specify a path to the updater config file",
		},
		cli.IntFlag{
			Name:  "user-cache-size",
			Usage: "Number of User entries to cache.",
		},
		cli.StringFlag{
			Name:  "vdebug",
			Usage: "Verbose debugging; takes a comma-joined list of levels and tags",
		},
		cli.BoolFlag{
			Name:  "bg-identifier-disabled",
			Usage: "supply to disable the BG identifier loop",
		},
	}
	if extraFlags != nil {
		app.Flags = append(app.Flags, extraFlags...)
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

// AddHelpTopics appends topics to the list of help topics for
// this app.
func (p *CommandLine) AddHelpTopics(topics []cli.HelpTopic) {
	p.app.HelpTopics = append(p.app.HelpTopics, topics...)
}
