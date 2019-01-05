package matcher

type shortcut bool

const (
	theShortcut = shortcut(true)
)

// NewShortcut create a special matcher that always matches and doesn't consume any input
func NewShortcut() Matcher {
	return theShortcut
}
func (shortcut) Match(args []string, c *ParseContext) (bool, []string) {
	return true, args
}

func (shortcut) Priority() int {
	return 10
}

func (shortcut) String() string {
	return "*"
}
