package cli

import (
	"flag"
	"strings"

	"github.com/jawher/mow.cli/internal/container"
	"github.com/jawher/mow.cli/internal/values"
)

// BoolOpt describes a boolean option
type BoolOpt struct {
	// A space separated list of the option names *WITHOUT* the dashes, e.g. `f force` and *NOT* `-f --force`.
	// The one letter names will then be called with a single dash (short option), the others with two (long options).
	Name string
	// The option description as will be shown in help messages
	Desc string
	// A space separated list of environment variables names to be used to initialize this option
	EnvVar string
	// The option's initial value
	Value bool
	// A boolean to display or not the current value of the option in the help message
	HideValue bool
	// Set to true if this option was set by the user (as opposed to being set from env or not set at all)
	SetByUser *bool
}

func (o BoolOpt) value() bool {
	return o.Value
}

// StringOpt describes a string option
type StringOpt struct {
	// A space separated list of the option names *WITHOUT* the dashes, e.g. `f force` and *NOT* `-f --force`.
	// The one letter names will then be called with a single dash (short option), the others with two (long options).
	Name string
	// The option description as will be shown in help messages
	Desc string
	// A space separated list of environment variables names to be used to initialize this option
	EnvVar string
	// The option's initial value
	Value string
	// A boolean to display or not the current value of the option in the help message
	HideValue bool
	// Set to true if this option was set by the user (as opposed to being set from env or not set at all)
	SetByUser *bool
}

func (o StringOpt) value() string {
	return o.Value
}

// IntOpt describes an int option
type IntOpt struct {
	// A space separated list of the option names *WITHOUT* the dashes, e.g. `f force` and *NOT* `-f --force`.
	// The one letter names will then be called with a single dash (short option), the others with two (long options).
	Name string
	// The option description as will be shown in help messages
	Desc string
	// A space separated list of environment variables names to be used to initialize this option
	EnvVar string
	// The option's initial value
	Value int
	// A boolean to display or not the current value of the option in the help message
	HideValue bool
	// Set to true if this option was set by the user (as opposed to being set from env or not set at all)
	SetByUser *bool
}

func (o IntOpt) value() int {
	return o.Value
}

// StringsOpt describes a string slice option
type StringsOpt struct {
	// A space separated list of the option names *WITHOUT* the dashes, e.g. `f force` and *NOT* `-f --force`.
	// The one letter names will then be called with a single dash (short option), the others with two (long options).
	Name string
	// The option description as will be shown in help messages
	Desc string
	// A space separated list of environment variables names to be used to initialize this option.
	// The env variable should contain a comma separated list of values
	EnvVar string
	// The option's initial value
	Value []string
	// A boolean to display or not the current value of the option in the help message
	HideValue bool
	// Set to true if this option was set by the user (as opposed to being set from env or not set at all)
	SetByUser *bool
}

func (o StringsOpt) value() []string {
	return o.Value
}

// IntsOpt describes an int slice option
type IntsOpt struct {
	// A space separated list of the option names *WITHOUT* the dashes, e.g. `f force` and *NOT* `-f --force`.
	// The one letter names will then be called with a single dash (short option), the others with two (long options).
	Name string
	// The option description as will be shown in help messages
	Desc string
	// A space separated list of environment variables names to be used to initialize this option.
	// The env variable should contain a comma separated list of values
	EnvVar string
	// The option's initial value
	Value []int
	// A boolean to display or not the current value of the option in the help message
	HideValue bool
	// Set to true if this option was set by the user (as opposed to being set from env or not set at all)
	SetByUser *bool
}

func (o IntsOpt) value() []int {
	return o.Value
}

// VarOpt describes an option where the type and format of the value is controlled by the developer
type VarOpt struct {
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
	// Set to true if this option was set by the user (as opposed to being set from env or not set at all)
	SetByUser *bool
}

func (o VarOpt) value() flag.Value {
	return o.Value
}

/*
BoolOpt defines a boolean option on the command c named `name`, with an initial value of `value` and a description of `desc` which will be used in help messages.

The name is a space separated list of the option names *WITHOUT* the dashes, e.g. `f force` and *NOT* `-f --force`.
The one letter names will then be called with a single dash (short option), the others with two (long options).


The result should be stored in a variable (a pointer to a bool) which will be populated when the app is run and the call arguments get parsed
*/
func (c *Cmd) BoolOpt(name string, value bool, desc string) *bool {
	return c.Bool(BoolOpt{
		Name:  name,
		Value: value,
		Desc:  desc,
	})
}

/*
StringOpt defines a string option on the command c named `name`, with an initial value of `value` and a description of `desc` which will be used in help messages.

The name is a space separated list of the option names *WITHOUT* the dashes, e.g. `f force` and *NOT* `-f --force`.
The one letter names will then be called with a single dash (short option), the others with two (long options).


The result should be stored in a variable (a pointer to a string) which will be populated when the app is run and the call arguments get parsed
*/
func (c *Cmd) StringOpt(name string, value string, desc string) *string {
	return c.String(StringOpt{
		Name:  name,
		Value: value,
		Desc:  desc,
	})
}

/*
IntOpt defines an int option on the command c named `name`, with an initial value of `value` and a description of `desc` which will be used in help messages.

The name is a space separated list of the option names *WITHOUT* the dashes, e.g. `f force` and *NOT* `-f --force`.
The one letter names will then be called with a single dash (short option), the others with two (long options).


The result should be stored in a variable (a pointer to an int) which will be populated when the app is run and the call arguments get parsed
*/
func (c *Cmd) IntOpt(name string, value int, desc string) *int {
	return c.Int(IntOpt{
		Name:  name,
		Value: value,
		Desc:  desc,
	})
}

/*
StringsOpt defines a string slice option on the command c named `name`, with an initial value of `value` and a description of `desc` which will be used in help messages.

The name is a space separated list of the option names *WITHOUT* the dashes, e.g. `f force` and *NOT* `-f --force`.
The one letter names will then be called with a single dash (short option), the others with two (long options).


The result should be stored in a variable (a pointer to a string slice) which will be populated when the app is run and the call arguments get parsed
*/
func (c *Cmd) StringsOpt(name string, value []string, desc string) *[]string {
	return c.Strings(StringsOpt{
		Name:  name,
		Value: value,
		Desc:  desc,
	})
}

/*
IntsOpt defines an int slice option on the command c named `name`, with an initial value of `value` and a description of `desc` which will be used in help messages.

The name is a space separated list of the option names *WITHOUT* the dashes, e.g. `f force` and *NOT* `-f --force`.
The one letter names will then be called with a single dash (short option), the others with two (long options).


The result should be stored in a variable (a pointer to an int slice) which will be populated when the app is run and the call arguments get parsed
*/
func (c *Cmd) IntsOpt(name string, value []int, desc string) *[]int {
	return c.Ints(IntsOpt{
		Name:  name,
		Value: value,
		Desc:  desc,
	})
}

/*
VarOpt defines an option where the type and format is controlled by the developer.

The name is a space separated list of the option names *WITHOUT* the dashes, e.g. `f force` and *NOT* `-f --force`.
The one letter names will then be called with a single dash (short option), the others with two (long options).


The result will be stored in the value parameter (a value implementing the flag.Value interface) which will be populated when the app is run and the call arguments get parsed
*/
func (c *Cmd) VarOpt(name string, value flag.Value, desc string) {
	c.mkOpt(container.Container{Name: name, Desc: desc, Value: value})
}

func mkOptStrs(optName string) []string {
	res := strings.Fields(optName)
	for i, name := range res {
		prefix := "-"
		if len(name) > 1 {
			prefix = "--"
		}
		res[i] = prefix + name
	}
	return res
}

func (c *Cmd) mkOpt(opt container.Container) {
	opt.ValueSetFromEnv = values.SetFromEnv(opt.Value, opt.EnvVar)

	opt.Names = mkOptStrs(opt.Name)

	c.options = append(c.options, &opt)
	for _, name := range opt.Names {
		c.optionsIdx[name] = &opt
	}
}
