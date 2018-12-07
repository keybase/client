package matcher

/*
Matcher is used to parse and consume the args and populate the ParseContext
*/
type Matcher interface {
	/* Match examines the provided args and:
	- likes it, fills the parse context and returns true and the remaining args it didn't consume
	- doesn't like it, returns false and  the remaining args it didn't consume
	*/
	Match(args []string, c *ParseContext) (bool, []string)
	// Priority used to sort matchers. the lower the returned number, the higher the priority of the matcher
	Priority() int
}

// IsShortcut is a helper to determine whether a given matcher is a Shortcut (always matches)
func IsShortcut(matcher Matcher) bool {
	_, ok := matcher.(shortcut)
	return ok
}
