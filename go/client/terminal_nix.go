// +build darwin dragonfly freebsd linux nacl netbsd openbsd solaris

package client

import (
	"fmt"
	"os"

	"golang.org/x/crypto/ssh/terminal"
)

type TerminalEngine struct {
	tty           *os.File
	fd            int
	oldTerminal   *terminal.State
	terminal      *terminal.Terminal
	started       bool
	width, height int
}

func (t *TerminalEngine) Init() error {
	return nil
}

func NewTerminalEngine() *TerminalEngine {
	return &TerminalEngine{fd: -1}
}

var globalIsStarted = false

func (t *TerminalEngine) GetSize() (int, int) {
	if err := t.Startup(); err != nil {
		return 0, 0
	}
	return t.width, t.height
}

func (t *TerminalEngine) Startup() error {

	if t.started {
		return nil
	}

	t.started = true

	if globalIsStarted {
		return fmt.Errorf("Can only instantiate one terminal wrapper per proc")
	}

	globalIsStarted = true

	G.Log.Debug("+ Opening up /dev/tty terminal on Linux and OSX")
	file, err := os.OpenFile("/dev/tty", os.O_RDWR, 0)
	if err != nil {
		return err
	}
	t.tty = file
	t.fd = int(t.tty.Fd())
	t.width, t.height, err = terminal.GetSize(t.fd)
	if err != nil {
		return err
	}

	t.oldTerminal, err = terminal.MakeRaw(t.fd)
	if err != nil {
		return err
	}
	G.Log.Debug("| switched to raw console for tty")
	if t.terminal = terminal.NewTerminal(file, ""); t.terminal == nil {
		return fmt.Errorf("failed to open terminal")
	}
	t.terminal.AutoCompleteCallback = t.autoComp

	if err = t.terminal.SetSize(t.width, t.height); err != nil {
		return err
	}

	G.Log.Debug("- Done opening /dev/tty")
	return nil
}

func (t *TerminalEngine) Shutdown() error {
	if t.oldTerminal != nil {
		G.Log.Debug("Restoring terminal settings")

		// XXX bug in ssh/terminal. On success, we were getting an error
		// "errno 0"; so let's ignore it for now.
		terminal.Restore(t.fd, t.oldTerminal)
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

func (t *TerminalEngine) autoComp(line string, pos int, key rune) (newLine string, newPos int, ok bool) {
	// this is a hack to handle ctrl-c
	if key == 3 {
		G.Shutdown()
		G.Log.Error("interrupted")
		os.Exit(3)
	}
	return line, pos, false
}
