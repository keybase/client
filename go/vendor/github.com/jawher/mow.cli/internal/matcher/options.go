package matcher

import (
	"strings"

	"github.com/jawher/mow.cli/internal/container"
)

// NewOptions create an Options matcher which can parse a group of options
func NewOptions(opts []*container.Container, index map[string]*container.Container) Matcher {
	return &options{
		options: opts,
		index:   index,
	}
}

type options struct {
	options []*container.Container
	index   map[string]*container.Container
}

func (*options) Priority() int {
	return 2
}

func (om *options) Match(args []string, c *ParseContext) (bool, []string) {
	ok, nargs := om.try(args, c)
	if !ok {
		return false, args
	}

	for {
		ok, nnargs := om.try(nargs, c)
		if !ok {
			return true, nargs
		}
		nargs = nnargs
	}
}

func (om *options) try(args []string, c *ParseContext) (bool, []string) {
	if len(args) == 0 || c.RejectOptions {
		return false, args
	}
	for _, o := range om.options {
		if _, exclude := c.ExcludedOpts[o]; exclude {
			continue
		}
		if ok, nargs := (&opt{theOne: o, index: om.index}).Match(args, c); ok {
			if o.ValueSetFromEnv {
				c.ExcludedOpts[o] = struct{}{}
			}
			return true, nargs
		}
	}
	return false, args
}

func (om *options) String() string {
	names := "-"
	for _, opt := range om.options {
		s := strings.TrimPrefix(opt.Names[0], "-")
		names = names + s
	}
	return names
}
