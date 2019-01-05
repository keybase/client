package matcher

// NewOptsEnd returns the special matcher that matches the -- operator
func NewOptsEnd() Matcher {
	return theOptsEnd
}

const (
	theOptsEnd = optsEnd(true)
)

type optsEnd bool

func (optsEnd) Match(args []string, c *ParseContext) (bool, []string) {
	c.RejectOptions = true
	return true, args
}

func (optsEnd) Priority() int {
	return 9
}

func (optsEnd) String() string {
	return "--"
}
