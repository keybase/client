package cli

import (
	"flag"

	"github.com/jawher/mow.cli/internal/container"
	"github.com/jawher/mow.cli/internal/values"
)

// BoolArg describes a boolean argument
type BoolArg struct {
	// The argument name as will be shown in help messages
	Name string
	// The argument description as will be shown in help messages
	Desc string
	// A space separated list of environment variables names to be used to initialize this argument
	EnvVar string
	// The argument's initial value
	Value bool
	// A boolean to display or not the current value of the argument in the help message
	HideValue bool
	// Set to true if this arg was set by the user (as opposed to being set from env or not set at all)
	SetByUser *bool
}

func (a BoolArg) value() bool {
	return a.Value
}

// StringArg describes a string argument
type StringArg struct {
	// The argument name as will be shown in help messages
	Name string
	// The argument description as will be shown in help messages
	Desc string
	// A space separated list of environment variables names to be used to initialize this argument
	EnvVar string
	// The argument's initial value
	Value string
	// A boolean to display or not the current value of the argument in the help message
	HideValue bool
	// Set to true if this arg was set by the user (as opposed to being set from env or not set at all)
	SetByUser *bool
}

func (a StringArg) value() string {
	return a.Value
}

// IntArg describes an int argument
type IntArg struct {
	// The argument name as will be shown in help messages
	Name string
	// The argument description as will be shown in help messages
	Desc string
	// A space separated list of environment variables names to be used to initialize this argument
	EnvVar string
	// The argument's initial value
	Value int
	// A boolean to display or not the current value of the argument in the help message
	HideValue bool
	// Set to true if this arg was set by the user (as opposed to being set from env or not set at all)
	SetByUser *bool
}

func (a IntArg) value() int {
	return a.Value
}

// StringsArg describes a string slice argument
type StringsArg struct {
	// The argument name as will be shown in help messages
	Name string
	// The argument description as will be shown in help messages
	Desc string
	// A space separated list of environment variables names to be used to initialize this argument.
	// The env variable should contain a comma separated list of values
	EnvVar string
	// The argument's initial value
	Value []string
	// A boolean to display or not the current value of the argument in the help message
	HideValue bool
	// Set to true if this arg was set by the user (as opposed to being set from env or not set at all)
	SetByUser *bool
}

func (a StringsArg) value() []string {
	return a.Value
}

// IntsArg describes an int slice argument
type IntsArg struct {
	// The argument name as will be shown in help messages
	Name string
	// The argument description as will be shown in help messages
	Desc string
	// A space separated list of environment variables names to be used to initialize this argument.
	// The env variable should contain a comma separated list of values
	EnvVar string
	// The argument's initial value
	Value []int
	// A boolean to display or not the current value of the argument in the help message
	HideValue bool
	// Set to true if this arg was set by the user (as opposed to being set from env or not set at all)
	SetByUser *bool
}

func (a IntsArg) value() []int {
	return a.Value
}

// VarArg describes an argument where the type and format of the value is controlled by the developer
type VarArg struct {
	// A space separated list of the option names *WITHOUT* the dashes, e.g. `f force` and *NOT* `-f --force`.
	// The one letter names will then be called with a single dash (short option), the others with two (long options).
	Name string
	// The option description as will be shown in help messages
	Desc string
	// A space separated list of environment variables names to be used to initialize this option
	EnvVar string
	// A value implementing the flag.Value type (will hold the final value)
	Value flag.Value
	// A boolean to display or not the current value of the option in the help message
	HideValue bool
	// Set to true if this arg was set by the user (as opposed to being set from env or not set at all)
	SetByUser *bool
}

func (a VarArg) value() flag.Value {
	return a.Value
}

/*
BoolArg defines a boolean argument on the command c named `name`, with an initial value of `value` and a description of `desc` which will be used in help messages.

The result should be stored in a variable (a pointer to a bool) which will be populated when the app is run and the call arguments get parsed
*/
func (c *Cmd) BoolArg(name string, value bool, desc string) *bool {
	return c.Bool(BoolArg{
		Name:  name,
		Value: value,
		Desc:  desc,
	})
}

/*
StringArg defines a string argument on the command c named `name`, with an initial value of `value` and a description of `desc` which will be used in help messages.

The result should be stored in a variable (a pointer to a string) which will be populated when the app is run and the call arguments get parsed
*/
func (c *Cmd) StringArg(name string, value string, desc string) *string {
	return c.String(StringArg{
		Name:  name,
		Value: value,
		Desc:  desc,
	})
}

/*
IntArg defines an int argument on the command c named `name`, with an initial value of `value` and a description of `desc` which will be used in help messages.

The result should be stored in a variable (a pointer to an int) which will be populated when the app is run and the call arguments get parsed
*/
func (c *Cmd) IntArg(name string, value int, desc string) *int {
	return c.Int(IntArg{
		Name:  name,
		Value: value,
		Desc:  desc,
	})
}

/*
StringsArg defines a string slice argument on the command c named `name`, with an initial value of `value` and a description of `desc` which will be used in help messages.

The result should be stored in a variable (a pointer to a string slice) which will be populated when the app is run and the call arguments get parsed
*/
func (c *Cmd) StringsArg(name string, value []string, desc string) *[]string {
	return c.Strings(StringsArg{
		Name:  name,
		Value: value,
		Desc:  desc,
	})
}

/*
IntsArg defines an int slice argument on the command c named `name`, with an initial value of `value` and a description of `desc` which will be used in help messages.

The result should be stored in a variable (a pointer to an int slice) which will be populated when the app is run and the call arguments get parsed
*/
func (c *Cmd) IntsArg(name string, value []int, desc string) *[]int {
	return c.Ints(IntsArg{
		Name:  name,
		Value: value,
		Desc:  desc,
	})
}

/*
VarArg defines an argument where the type and format is controlled by the developer on the command c named `name` and a description of `desc` which will be used in help messages.

The result will be stored in the value parameter (a value implementing the flag.Value interface) which will be populated when the app is run and the call arguments get parsed
*/
func (c *Cmd) VarArg(name string, value flag.Value, desc string) {
	c.mkArg(container.Container{Name: name, Desc: desc, Value: value})
}

func (c *Cmd) mkArg(arg container.Container) {
	arg.ValueSetFromEnv = values.SetFromEnv(arg.Value, arg.EnvVar)

	c.args = append(c.args, &arg)
	c.argsIdx[arg.Name] = &arg
}
