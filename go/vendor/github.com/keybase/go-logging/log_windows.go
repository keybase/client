// +build windows
// Copyright 2013, Örjan Persson. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package logging

import (
	"bytes"
	"io"
	"os"
	"log"
	"syscall"
)

var (
	kernel32DLL = syscall.NewLazyDLL("kernel32.dll")
	setConsoleTextAttributeProc = kernel32DLL.NewProc("SetConsoleTextAttribute")
)

// TODO initialize here
var colors []WORD
var boldcolors []WORD

type color int
type WORD  uint16

const (
	// Character attributes
	// Note:
	// -- The attributes are combined to produce various colors (e.g., Blue + Green will create Cyan).
	//    Clearing all foreground or background colors results in black; setting all creates white.
	// See https://msdn.microsoft.com/en-us/library/windows/desktop/ms682088(v=vs.85).aspx#_win32_character_attributes.
	FOREGROUND_BLACK     WORD = 0x0000
	FOREGROUND_BLUE      WORD = 0x0001
	FOREGROUND_GREEN     WORD = 0x0002
	FOREGROUND_CYAN      WORD = 0x0003
	FOREGROUND_RED       WORD = 0x0004
	FOREGROUND_MAGENTA   WORD = 0x0005
	FOREGROUND_YELLOW    WORD = 0x0006
	FOREGROUND_WHITE     WORD = 0x0007
	FOREGROUND_INTENSITY WORD = 0x0008
	FOREGROUND_MASK      WORD = 0x000F
)

// LogBackend utilizes the standard log module.
type LogBackend struct {
	Logger *log.Logger
	Color  bool
	Handle uintptr
}

// NewLogBackend creates a new LogBackend.
func NewLogBackend(out *os.File, prefix string, flag int) *LogBackend {
	return &LogBackend{Logger: log.New(out, prefix, flag), Handle: out.Fd() }
}

func (b *LogBackend) Log(level Level, calldepth int, rec *Record) error {
	if b.Color {
		buf := &bytes.Buffer{}
		setConsoleTextAttribute(b.Handle, colors[level])
		buf.Write([]byte(rec.Formatted(calldepth + 1)))
		// For some reason, the Go logger arbitrarily decided "2" was the correct
		// call depth...
		err := b.Logger.Output(calldepth+2, buf.String())
		setConsoleTextAttribute(b.Handle, FOREGROUND_WHITE)
		return err
	} else {
		return b.Logger.Output(calldepth+2, rec.Formatted(calldepth+1))
	}
	panic("should not be reached")
}

func init() {
	colors = []WORD{
		INFO:     FOREGROUND_WHITE,
		CRITICAL: FOREGROUND_MAGENTA,
		ERROR:    FOREGROUND_RED,
		WARNING:  FOREGROUND_YELLOW,
		NOTICE:   FOREGROUND_GREEN,
		DEBUG:    FOREGROUND_CYAN,
	}
	boldcolors = []WORD{
		INFO:     FOREGROUND_WHITE | FOREGROUND_INTENSITY,
		CRITICAL: FOREGROUND_MAGENTA | FOREGROUND_INTENSITY,
		ERROR:    FOREGROUND_RED | FOREGROUND_INTENSITY,
		WARNING:  FOREGROUND_YELLOW | FOREGROUND_INTENSITY,
		NOTICE:   FOREGROUND_GREEN | FOREGROUND_INTENSITY,
		DEBUG:    FOREGROUND_CYAN | FOREGROUND_INTENSITY,
	}
}

// setConsoleTextAttribute sets the attributes of characters written to the
// console screen buffer by the WriteFile or WriteConsole function.
// See http://msdn.microsoft.com/en-us/library/windows/desktop/ms686047(v=vs.85).aspx.
func setConsoleTextAttribute(handle uintptr, attribute WORD) error {
	r1, r2, err := setConsoleTextAttributeProc.Call(handle, uintptr(attribute), 0)
	use(attribute)
	return checkError(r1, r2, err)
}


// checkError evaluates the results of a Windows API call and returns the error if it failed.
func checkError(r1, r2 uintptr, err error) error {
	// Windows APIs return non-zero to indicate success
	if r1 != 0 {
		return nil
	}
	
	// Return the error if provided, otherwise default to EINVAL
	if err != nil {
		return err
	}
	return syscall.EINVAL
}

// use is a no-op, but the compiler cannot see that it is.
// Calling use(p) ensures that p is kept live until that point.
func use(p interface{}) {}

func doFmtVerbLevelColor(layout string, level Level, output io.Writer) {
	// no-op for now. We need the file descriptor to do colors.
}