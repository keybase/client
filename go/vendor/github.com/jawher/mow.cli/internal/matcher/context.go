package matcher

import "github.com/jawher/mow.cli/internal/container"

// ParseContext holds the state of the arguments parsing, i.e. the encountered options and arguments values, etc.
type ParseContext struct {
	Args          map[*container.Container][]string
	Opts          map[*container.Container][]string
	ExcludedOpts  map[*container.Container]struct{}
	RejectOptions bool
}

// NewParseContext create a new ParseContext
func NewParseContext() ParseContext {
	return ParseContext{
		Args:          map[*container.Container][]string{},
		Opts:          map[*container.Container][]string{},
		ExcludedOpts:  map[*container.Container]struct{}{},
		RejectOptions: false,
	}
}

// Merge adds the values in the provided context in the current context
func (pc ParseContext) Merge(o ParseContext) {
	for k, vs := range o.Args {
		pc.Args[k] = append(pc.Args[k], vs...)
	}

	for k, vs := range o.Opts {
		pc.Opts[k] = append(pc.Opts[k], vs...)
	}
}
