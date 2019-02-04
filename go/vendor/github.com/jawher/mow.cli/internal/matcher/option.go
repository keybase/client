package matcher

import (
	"strings"

	"github.com/jawher/mow.cli/internal/container"
	"github.com/jawher/mow.cli/internal/values"
)

// NewOpt create an option matcher that can consume short and long options
func NewOpt(o *container.Container, index map[string]*container.Container) Matcher {
	return &opt{
		theOne: o,
		index:  index,
	}
}

type opt struct {
	theOne *container.Container
	index  map[string]*container.Container
}

func (*opt) Priority() int {
	return 1
}

func (o *opt) String() string {
	return o.theOne.Names[0]
}

func (o *opt) Match(args []string, c *ParseContext) (bool, []string) {
	if len(args) == 0 || c.RejectOptions {
		return o.theOne.ValueSetFromEnv, args
	}

	idx := 0
	for idx < len(args) {
		arg := args[idx]
		switch {
		case arg == "-":
			idx++
		case arg == "--":
			return o.theOne.ValueSetFromEnv, args
		case strings.HasPrefix(arg, "--"):
			matched, consumed, nargs := o.matchLongOpt(args, idx, c)

			if matched {
				return true, nargs
			}
			if consumed == 0 {
				return o.theOne.ValueSetFromEnv, args
			}
			idx += consumed

		case strings.HasPrefix(arg, "-"):
			matched, consumed, nargs := o.matchShortOpt(args, idx, c)
			if matched {
				return true, nargs
			}
			if consumed == 0 {
				return o.theOne.ValueSetFromEnv, args
			}
			idx += consumed

		default:
			return o.theOne.ValueSetFromEnv, args
		}
	}
	return o.theOne.ValueSetFromEnv, args
}

func (o *opt) matchLongOpt(args []string, idx int, c *ParseContext) (bool, int, []string) {
	arg := args[idx]
	kv := strings.SplitN(arg, "=", 2)
	name := kv[0]
	opt, found := o.index[name]
	if !found {
		return false, 0, args
	}

	switch {
	case len(kv) == 2:
		if opt != o.theOne {
			return false, 1, args
		}
		value := kv[1]
		if value == "" {
			return false, 0, args
		}
		c.Opts[o.theOne] = append(c.Opts[o.theOne], value)
		return true, 1, removeStringAt(idx, args)
	case values.IsBool(opt.Value):
		if opt != o.theOne {
			return false, 1, args
		}
		c.Opts[o.theOne] = append(c.Opts[o.theOne], "true")
		return true, 1, removeStringAt(idx, args)
	default:
		if len(args[idx:]) < 2 {
			return false, 0, args
		}
		if opt != o.theOne {
			return false, 2, args
		}
		value := args[idx+1]
		if strings.HasPrefix(value, "-") {
			return false, 0, args
		}
		c.Opts[o.theOne] = append(c.Opts[o.theOne], value)
		return true, 2, removeStringsBetween(idx, idx+1, args)
	}
}

func (o *opt) matchShortOpt(args []string, idx int, c *ParseContext) (bool, int, []string) {
	arg := args[idx]
	if len(arg) < 2 {
		return false, 0, args
	}

	if strings.HasPrefix(arg[2:], "=") {
		name := arg[0:2]
		opt, _ := o.index[name]
		if opt != o.theOne {
			return false, 1, args
		}

		value := arg[3:]
		if value == "" {
			return false, 0, args
		}
		c.Opts[o.theOne] = append(c.Opts[o.theOne], value)
		return true, 1, removeStringAt(idx, args)

	}

	rem := arg[1:]

	remIdx := 0
	for len(rem[remIdx:]) > 0 {
		name := "-" + rem[remIdx:remIdx+1]

		opt, found := o.index[name]
		if !found {
			return false, 0, args
		}

		if values.IsBool(opt.Value) {
			if opt != o.theOne {
				remIdx++
				continue
			}

			c.Opts[o.theOne] = append(c.Opts[o.theOne], "true")
			newRem := rem[:remIdx] + rem[remIdx+1:]
			if newRem == "" {
				return true, 1, removeStringAt(idx, args)
			}
			return true, 0, replaceStringAt(idx, "-"+newRem, args)
		}

		value := rem[remIdx+1:]
		if value == "" {
			if len(args[idx+1:]) == 0 {
				return false, 0, args
			}
			if opt != o.theOne {
				return false, 2, args
			}

			value = args[idx+1]
			if strings.HasPrefix(value, "-") {
				return false, 0, args
			}
			c.Opts[o.theOne] = append(c.Opts[o.theOne], value)

			newRem := rem[:remIdx]
			if newRem == "" {
				return true, 2, removeStringsBetween(idx, idx+1, args)
			}

			nargs := replaceStringAt(idx, "-"+newRem, args)

			return true, 1, removeStringAt(idx+1, nargs)
		}

		if opt != o.theOne {
			return false, 1, args
		}
		c.Opts[o.theOne] = append(c.Opts[o.theOne], value)
		newRem := rem[:remIdx]
		if newRem == "" {
			return true, 1, removeStringAt(idx, args)
		}
		return true, 0, replaceStringAt(idx, "-"+newRem, args)

	}

	return false, 1, args
}
