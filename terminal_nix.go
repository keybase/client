// +build linux darwin

package libkb

import (
	"code.google.com/p/go.crypto/ssh/terminal"
	"fmt"
	"os"
)

type TerminalEngine struct {
	tty          *os.File
	fd           int
	old_terminal *terminal.State
	terminal     *terminal.Terminal
	started      bool
}

func (t *TerminalEngine) Init() error {
	return nil
}

func NewTerminalEngine() *TerminalEngine {
	return &TerminalEngine{nil, -1, nil, nil, false}
}

var global_is_started = false

func (t *TerminalEngine) Startup() error {

	if t.started {
		return nil
	}

	t.started = true

	if !G.RunMode.HasTerminal {
		return fmt.Errorf("No access to terminal in background mode")
	}

	if global_is_started {
		return fmt.Errorf("Can only instantiate one terminal wrapper per proc")
	}

	global_is_started = true

	G.Log.Debug("+ Opening up /dev/tty terminal on Linux and OSX")
	file, err := os.OpenFile("/dev/tty", os.O_RDWR, 0)
	if err != nil {
		return err
	}
	t.tty = file
	t.fd = int(t.tty.Fd())
	t.old_terminal, err = terminal.MakeRaw(t.fd)
	if err != nil {
		return err
	}
	G.Log.Debug("| switched to raw console for tty")
	if t.terminal = terminal.NewTerminal(file, ""); t.terminal == nil {
		return fmt.Errorf("failed to open terminal")
	}
	G.Log.Debug("- Done opening /dev/tty")
	return nil
}

func (t *TerminalEngine) Shutdown() error {
	if t.old_terminal != nil {
		G.Log.Debug("Restoring terminal settings")

		// XXX bug in ssh/terminal. On success, we were getting an error
		// "errno 0"; so let's ignore it for now.
		terminal.Restore(t.fd, t.old_terminal)
	}
	return nil
}

func (t *TerminalEngine) PromptPassword(prompt string) (string, error) {
	if err := t.Startup(); err != nil {
		return "", err
	}
	return t.terminal.ReadPassword(prompt)
}

func (t *TerminalEngine) Write(s string) error {
	if err := t.Startup(); err != nil {
		return err
	}
	_, err := t.terminal.Write([]byte(s))
	return err
}

func (t *TerminalEngine) Prompt(prompt string) (string, error) {
	if err := t.Startup(); err != nil {
		return "", err
	}
	if len(prompt) >= 0 {
		t.Write(prompt)
	}
	return t.terminal.ReadLine()
}

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
