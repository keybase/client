package cli

import (
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/jawher/mow.cli/internal/container"
	"github.com/jawher/mow.cli/internal/flow"
)

/*
Cli represents the structure of a CLI app. It should be constructed using the App() function
*/
type Cli struct {
	*Cmd
	version *cliVersion
}

type cliVersion struct {
	version string
	option  *container.Container
}

/*
App creates a new and empty CLI app configured with the passed name and description.

name and description will be used to construct the help message for the app:

	Usage: $name [OPTIONS] COMMAND [arg...]

	$desc

*/
func App(name, desc string) *Cli {
	return &Cli{
		Cmd: &Cmd{
			name:          name,
			desc:          desc,
			optionsIdx:    map[string]*container.Container{},
			argsIdx:       map[string]*container.Container{},
			ErrorHandling: flag.ExitOnError,
		},
	}
}

/*
Version sets the version string of the CLI app together with the options that can be used to trigger
printing the version string via the CLI.

	Usage: appName --$name
	$version

*/
func (cli *Cli) Version(name, version string) {
	cli.Bool(BoolOpt{
		Name:      name,
		Value:     false,
		Desc:      "Show the version and exit",
		HideValue: true,
	})
	names := mkOptStrs(name)
	option := cli.optionsIdx[names[0]]
	cli.version = &cliVersion{version, option}
}

func (cli *Cli) parse(args []string, entry, inFlow, outFlow *flow.Step) error {
	// We overload Cmd.parse() and handle cases that only apply to the CLI command, like versioning
	// After that, we just call Cmd.parse() for the default behavior
	if cli.versionSetAndRequested(args) {
		cli.PrintVersion()
		cli.onError(errVersionRequested)
		return nil
	}
	return cli.Cmd.parse(args, entry, inFlow, outFlow)
}

func (cli *Cli) versionSetAndRequested(args []string) bool {
	return cli.version != nil && cli.isFlagSet(args, cli.version.option.Names)
}

/*
PrintVersion prints the CLI app's version.
In most cases the library users won't need to call this method, unless
a more complex validation is needed.
*/
func (cli *Cli) PrintVersion() {
	fmt.Fprintln(stdErr, cli.version.version)
}

/*
Run uses the app configuration (specs, commands, ...) to parse the args slice
and to execute the matching command.

In case of an incorrect usage, and depending on the configured ErrorHandling policy,
it may return an error, panic or exit
*/
func (cli *Cli) Run(args []string) error {
	if err := cli.doInit(); err != nil {
		panic(err)
	}
	inFlow := &flow.Step{Desc: "RootIn", Exiter: exiter}
	outFlow := &flow.Step{Desc: "RootOut", Exiter: exiter}
	return cli.parse(args[1:], inFlow, inFlow, outFlow)
}

/*
ActionCommand is a convenience function to configure a command with an action.

cmd.ActionCommand(_, _, myFunc) is equivalent to cmd.Command(_, _, func(cmd *cli.Cmd) { cmd.Action = myFunc })
*/
func ActionCommand(action func()) CmdInitializer {
	return func(cmd *Cmd) {
		cmd.Action = action
	}
}

/*
Exit causes the app the exit with the specified exit code while giving the After interceptors a chance to run.
This should be used instead of os.Exit.
*/
func Exit(code int) {
	panic(flow.ExitCode(code))
}

var exiter = func(code int) {
	os.Exit(code)
}

var (
	stdOut io.Writer = os.Stdout
	stdErr io.Writer = os.Stderr
)
