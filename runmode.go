package libkb

type RunMode struct {
	HasTerminal bool
}

func NewRunMode() *RunMode {
	return &RunMode{false}
}
