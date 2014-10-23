package libkb

type TerminalImplementation struct {
	engine *TerminalEngine
}

func NewTerminalImplementation() TerminalImplementation {
	return TerminalImplementation{NewTerminalEngine()}
}
func (t TerminalImplementation) Startup() error {
	return t.engine.Startup()
}
func (t TerminalImplementation) Init() error {
	return t.engine.Init()
}
func (t TerminalImplementation) Shutdown() error {
	return t.engine.Shutdown()
}
func (t TerminalImplementation) PromptPassword(s string) (string, error) {
	return t.engine.PromptPassword(s)
}
func (t TerminalImplementation) Write(s string) error {
	return t.engine.Write(s)
}
func (t TerminalImplementation) Prompt(s string) (string, error) {
	return t.engine.Prompt(s)
}
func (t TerminalImplementation) WriteColored(cl ColoredLine) error {
	return t.engine.WriteColored(cl)
}
func (t TerminalImplementation) WriteColoredLine(cl ColoredLine) error {
	return t.engine.WriteColoredLine(cl)
}
