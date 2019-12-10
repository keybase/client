package cli

import (
	"flag"
	"fmt"
	"io/ioutil"
	"strings"
)

// Command is a subcommand for a cli.App.
type Command struct {
	// The name of the command
	Name string
	// short name of the command. Typically one character (deprecated, use `Aliases`)
	ShortName string
	// A list of aliases for the command
	Aliases []string
	// A short description of the usage of this command
	Usage string
	// Boolean to hide from command and subcommand lists.
	Unlisted bool
	// A longer explanation of how the command works
	Description string
	// Example usage
	Examples string
	// The function to call when checking for bash command completions
	BashComplete func(context *Context)
	// An action to execute before any sub-subcommands are run, but after the context is ready
	// If a non-nil error is returned, no sub-subcommands are run
	Before func(context *Context) error
	// An action to execute after any subcommands are run, but after the subcommand has finished
	// It is run even if Action() panics
	After func(context *Context) error
	// The function to call when this command is invoked
	Action func(context *Context)
	// List of child commands
	Subcommands []Command
	// List of flags to parse
	Flags []Flag
	// Treat all flags as normal arguments if true
	SkipFlagParsing bool
	// Boolean to hide built-in help command
	HideHelp bool
	// for non-flag argument help in USAGE section
	// For `app command <path1> <path2>`, ArgumentHelp would be "<path1> <path2>"
	ArgumentHelp string

	commandNamePath []string
}

// Returns the full name of the command.
// For subcommands this ensures that parent commands are part of the command path
func (c Command) FullName() string {
	if c.commandNamePath == nil {
		return c.Name
	}
	return strings.Join(c.commandNamePath, " ")
}

// Mirrors https://golang.org/src/flag/flag.go?s=24803:24876#L133
type boolFlag interface {
	flag.Value
	IsBoolFlag() bool
}

// We need to figure out whether the next arg is an argument to the flag
// rather than a regular argument. Our heuristic is
// 1) If the arg has an =, assume the value is passed in this arg
// 2) If it is *not* a bool var, assume the next arg is a flag argument
// 3) Else, assume it's a regular argument.
func nextArgWillBeFlagValueHeuristic(arg string, set *flag.FlagSet) bool {
	if set == nil {
		return false
	}
	if strings.Contains(arg, "=") {
		return false
	}
	trimmedName := strings.TrimPrefix(strings.TrimPrefix(arg, "-"), "-")
	gotFlag := set.Lookup(trimmedName)
	if gotFlag == nil {
		// Unrecognized flag
		return false
	}
	_, isBoolFlag := gotFlag.Value.(boolFlag)
	return !isBoolFlag
}

// Invokes the command given the context, parses ctx.Args() to generate command-specific flags
func (c Command) Run(ctx *Context) error {
	if len(c.Subcommands) > 0 || c.Before != nil || c.After != nil {
		return c.startApp(ctx)
	}

	if !c.HideHelp && (HelpFlag != BoolFlag{}) {
		// append help to flags
		c.Flags = append(
			c.Flags,
			HelpFlag,
		)
	}

	if ctx.App.EnableBashCompletion {
		c.Flags = append(c.Flags, BashCompletionFlag)
	}

	set := flagSet(c.Name, c.Flags)
	set.SetOutput(ioutil.Discard)

	// Go's `flag` package wants the flag arguments before regular arguments,
	// so we need to move the flag arguments.
	var err error
	if c.SkipFlagParsing {
		err = set.Parse(ctx.Args().Tail())
	} else {
		restArgs := ctx.Args()[1:]
		var regularArgs []string
		var flagArgs []string
		willBeFlagValue := false
		for index, arg := range restArgs {
			if arg == "--" {
				regularArgs = append(regularArgs, restArgs[index:]...)
				break
			}
			if willBeFlagValue {
				flagArgs = append(flagArgs, arg)
				willBeFlagValue = false
				continue
			}
			if strings.HasPrefix(arg, "-") {
				flagArgs = append(flagArgs, arg)
				willBeFlagValue = nextArgWillBeFlagValueHeuristic(arg, set)
			} else {
				regularArgs = append(regularArgs, arg)
			}
		}
		err = set.Parse(append(flagArgs, regularArgs...))
	}

	if err != nil {
		fmt.Fprintln(ctx.App.Writer, "Incorrect Usage.")
		fmt.Fprintln(ctx.App.Writer)
		ShowCommandHelp(ctx, c.Name)
		return err
	}

	nerr := normalizeFlags(c.Flags, set)
	if nerr != nil {
		fmt.Fprintln(ctx.App.Writer, nerr)
		fmt.Fprintln(ctx.App.Writer)
		ShowCommandHelp(ctx, c.Name)
		return nerr
	}
	context := NewContext(ctx.App, set, ctx)

	if checkCommandCompletions(context, c.Name) {
		return nil
	}

	if checkCommandHelp(context, c.Name) {
		return nil
	}
	context.Command = c
	c.Action(context)
	return nil
}

func (c Command) Names() []string {
	names := []string{c.Name}

	if c.ShortName != "" {
		names = append(names, c.ShortName)
	}

	return append(names, c.Aliases...)
}

// Returns true if Command.Name or Command.ShortName matches given name
func (c Command) HasName(name string) bool {
	for _, n := range c.Names() {
		if n == name {
			return true
		}
	}
	return false
}

// Strips and indents with 3 spaces examples.
func (c Command) ExamplesFormatted() string {
	prefix := "   "
	return prefix + strings.Join(strings.Split(strings.TrimSpace(c.Examples), "\n"), "\n"+prefix)
}

func (c Command) startApp(ctx *Context) error {
	app := NewApp()

	// set the name and usage
	app.Name = fmt.Sprintf("%s %s", ctx.App.Name, c.Name)
	if c.Description != "" {
		app.Usage = c.Description
	} else {
		app.Usage = c.Usage
	}

	// set CommandNotFound
	app.CommandNotFound = ctx.App.CommandNotFound

	// set the flags and commands
	app.Commands = c.Subcommands
	app.Flags = c.Flags
	app.HideHelp = c.HideHelp

	app.Version = ctx.App.Version
	app.HideVersion = ctx.App.HideVersion
	app.Compiled = ctx.App.Compiled
	app.Author = ctx.App.Author
	app.Email = ctx.App.Email
	app.Writer = ctx.App.Writer

	// bash completion
	app.EnableBashCompletion = ctx.App.EnableBashCompletion
	if c.BashComplete != nil {
		app.BashComplete = c.BashComplete
	}

	// set the actions
	app.Before = c.Before
	app.After = c.After
	if c.Action != nil {
		app.Action = c.Action
	} else {
		app.Action = helpSubcommand.Action
	}

	var newCmds []Command
	for _, cc := range app.Commands {
		cc.commandNamePath = []string{c.FullName(), cc.Name}
		newCmds = append(newCmds, cc)
	}
	app.Commands = newCmds

	return app.RunAsSubcommand(ctx)
}

type ByName []Command

func (c ByName) Len() int {
	return len(c)
}

func (c ByName) Swap(i, j int) {
	c[i], c[j] = c[j], c[i]
}

func (c ByName) Less(i, j int) bool {
	return c[i].Name < c[j].Name
}
