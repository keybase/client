package matcher

import (
	"strings"

	"github.com/jawher/mow.cli/internal/container"
)

// NewArg creates an (positional) argument matcher
func NewArg(a *container.Container) Matcher {
	return &arg{arg: a}
}

type arg struct {
	arg *container.Container
}

func (arg *arg) Match(args []string, c *ParseContext) (bool, []string) {
	if len(args) == 0 {
		return false, args
	}
	if !c.RejectOptions && strings.HasPrefix(args[0], "-") && args[0] != "-" {
		return false, args
	}
	c.Args[arg.arg] = append(c.Args[arg.arg], args[0])
	return true, args[1:]
}

func (*arg) Priority() int {
	return 8
}

func (arg *arg) String() string {
	return arg.arg.Name
}
