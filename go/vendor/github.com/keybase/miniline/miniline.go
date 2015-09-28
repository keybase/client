package miniline

import (
	"bufio"
	"os"
	"syscall"

	"golang.org/x/crypto/ssh/terminal"
)

// InterruptedError represents the user having exited the prompt with ^C
type InterruptedError struct{}

// Error is just the string "Interrupted"
func (e InterruptedError) Error() string {
	return "Interrupted"
}

// ErrInterrupted is a singleton InterruptedError
var ErrInterrupted error = InterruptedError{}

type tty interface {
	enterRaw() error
	exitRaw() error
}

type realTTY struct {
	fd    uintptr
	state *terminal.State
}

func (tty *realTTY) enterRaw() (err error) {
	tty.state, err = terminal.MakeRaw(int(tty.fd))
	return
}

func (tty *realTTY) exitRaw() (err error) {
	err = terminal.Restore(int(tty.fd), tty.state)
	tty.state = nil
	return
}

type lineReader struct {
	prompt string
	reader *bufio.Reader
	writer *bufio.Writer
	tty    tty
	buf    []byte
	pos    int
}

func newLineReader(ttyFile *os.File, prompt string) lineReader {
	return lineReader{
		prompt: prompt,
		reader: bufio.NewReader(ttyFile),
		writer: bufio.NewWriter(ttyFile),
		tty:    &realTTY{fd: ttyFile.Fd()},
	}
}

// esc prints an escape sequence with the given string and is used to control
// the terminal. Common ones (e.g. for moving the cursor) are documented here:
// https://en.wikipedia.org/wiki/ANSI_escape_code#CSI_codes
func (lr *lineReader) esc(s string) (err error) {
	_, err = lr.writer.WriteString("\x1b[" + s)
	return
}

// pprompt re-outputs the prompt
func (lr *lineReader) pprompt() (err error) {
	_, err = lr.writer.WriteString(lr.prompt)
	return
}

// pbuf re-writes the lr.buf to the terminal starting at lr.pos, and restores
// the cursor to its previous position. Used when editing the middle of a line.
func (lr *lineReader) pbuf() (err error) {
	if lr.pos == len(lr.buf) {
		return
	}
	err = lr.esc("s")
	if err == nil {
		_, err = lr.writer.Write(lr.buf[lr.pos:])
	}
	if err == nil {
		err = lr.esc("u")
	}
	return
}

// backspace removes the character to the left of the cursor, if any.
func (lr *lineReader) backspace() (err error) {
	if len(lr.buf) == 0 {
		return
	}

	err = lr.esc("D")
	if err == nil {
		err = lr.esc("K")
	}
	if lr.pos < len(lr.buf) {
		copy(lr.buf[lr.pos-1:], lr.buf[lr.pos:])
		lr.buf = lr.buf[:len(lr.buf)-1]
	} else {
		lr.buf = lr.buf[:len(lr.buf)-1]
	}
	lr.pos--

	if err == nil {
		err = lr.pbuf()
	}
	return
}

// readEscape is called after a the ESC character has been read from stdin. It
// expects an escape sequence to follow.
func (lr *lineReader) readEscape() (err error) {
	b, err := lr.reader.ReadByte()
	if err != nil {
		return
	}
	if b != byte('[') {
		err = lr.writer.WriteByte(0x7)
		return
	}
	b, err = lr.reader.ReadByte()
	if err != nil {
		return
	}
	switch b {
	case byte('A'), byte('B'): // up and down, noop
	case byte('C'): // right
		if lr.pos == len(lr.buf) {
			return
		}
		err = lr.esc("C")
		lr.pos++
	case byte('D'): // left
		if lr.pos == 0 {
			return
		}
		err = lr.esc("D")
		lr.pos--
	}
	return
}

// readLine is lineReader's entry point. It reads a line of user input.
func (lr *lineReader) readLine() error {

	if err := lr.tty.enterRaw(); err != nil {
		return err
	}
	defer lr.tty.exitRaw()

	lr.pprompt()
	defer func() {
		lr.writer.WriteString("\n")
		lr.writer.Flush()
	}()

	for {
		if err := lr.writer.Flush(); err != nil {
			return err
		}

		b, err := lr.reader.ReadByte()
		if err != nil {
			return err
		}
		if b <= 26 { // ctrl + letter
			switch b {
			case 3: // ^C
				return ErrInterrupted
			case 4, 13: // ^D, ^M (which is also the return key)
				return nil
			case 26: // ^Z
				lr.tty.exitRaw()
				syscall.Kill(0, syscall.SIGSTOP)
				lr.tty.enterRaw()
				lr.pprompt()
				lr.writer.Write(lr.buf[:lr.pos])
				lr.pbuf()
				continue
			default:
				continue
			}
		}

		switch b {
		case 0x7F: // backspace
			if err := lr.backspace(); err != nil {
				return err
			}
			continue
		case 0x1b: // ESC
			if err := lr.readEscape(); err != nil {
				return err
			}
			continue
		}

		lr.writer.WriteByte(b)

		if lr.pos == len(lr.buf) {
			lr.buf = append(lr.buf, b)
			lr.pos++
		} else {
			lr.buf = append(lr.buf, 0)
			copy(lr.buf[lr.pos+1:], lr.buf[lr.pos:])
			lr.buf[lr.pos] = b
			lr.pos++
			lr.pbuf()
		}
	}
}

// ReadLine returns a line of user input (terminated by a newline or or ^D)
// read from the tty. The given prompt is printed first. If the user types ^C,
// ReadLine returns ErrInterrupted.
func ReadLine(prompt string) (line string, err error) {
	tty, err := os.OpenFile("/dev/tty", os.O_RDWR, 0)
	if err != nil {
		return
	}
	defer tty.Close()

	reader := newLineReader(tty, prompt)
	err = reader.readLine()
	line = string(reader.buf)

	return
}
