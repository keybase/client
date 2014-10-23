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

func (t *TerminalEngine) GetCode(which string) []byte {
	switch which {
	case "black":
		return t.terminal.Escape.Black
	case "red":
		return t.terminal.Escape.Red
	case "green":
		return t.terminal.Escape.Green
	case "yellow":
		return t.terminal.Escape.Yellow
	case "blue":
		return t.terminal.Escape.Blue
	case "magenta":
		return t.terminal.Escape.Magenta
	case "cyan":
		return t.terminal.Escape.Cyan
	case "white":
		return t.terminal.Escape.White
	case "reset":
		return t.terminal.Escape.Reset
	default:
		return []byte{}
	}
}

func (t *TerminalEngine) WriteColored(line ColoredLine) error {

	if err := t.Startup(); err != nil {
		return err
	}

	plain := G.Env.GetPlainLogging()
	for _, c := range line {
		if len(c.Color) > 0 && !plain {
			t.terminal.Write(t.GetCode(c.Color))
			t.terminal.Write([]byte(c.Text))
			t.terminal.Write(t.GetCode("reset"))
		} else {
			t.terminal.Write([]byte(c.Text))
		}
	}
	return nil
}

func (t *TerminalEngine) WriteColoredLine(line ColoredLine) error {
	if err := t.WriteColored(line); err != nil {
		return err
	}
	t.terminal.Write([]byte{'\n'})
	return nil
}
