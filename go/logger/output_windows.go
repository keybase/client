// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

// Windows 10 has a new terminal that can do ANSI codes by itself, so all this
// other stuff is legacy - EXCEPT that the colors are not right! If they ever
// get it right, a capable terminal can be identified by
// calling GetConsoleMode and checking for
// ENABLE_VIRTUAL_TERMINAL_PROCESSING 0x0004

package logger

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"sync"
	"syscall"

	"golang.org/x/sys/windows"
	"unsafe"
)

var (
	kernel32DLL                    = windows.NewLazySystemDLL("kernel32.dll")
	setConsoleTextAttributeProc    = kernel32DLL.NewProc("SetConsoleTextAttribute")
	getConsoleScreenBufferInfoProc = kernel32DLL.NewProc("GetConsoleScreenBufferInfo")
	stdOutMutex                    sync.Mutex
	stdErrMutex                    sync.Mutex
	consoleMode                    WORD
)

type (
	SHORT int16
	WORD  uint16

	SMALL_RECT struct {
		Left   SHORT
		Top    SHORT
		Right  SHORT
		Bottom SHORT
	}

	COORD struct {
		X SHORT
		Y SHORT
	}

	CONSOLE_SCREEN_BUFFER_INFO struct {
		Size              COORD
		CursorPosition    COORD
		Attributes        WORD
		Window            SMALL_RECT
		MaximumWindowSize COORD
	}
)

const (
	// Character attributes
	// Note:
	// -- The attributes are combined to produce various colors (e.g., Blue + Green will create Cyan).
	//    Clearing all foreground or background colors results in black; setting all creates white.
	// See https://msdn.microsoft.com/en-us/library/windows/desktop/ms682088(v=vs.85).aspx#_win32_character_attributes.
	fgBlack     WORD = 0x0000
	fgBlue      WORD = 0x0001
	fgGreen     WORD = 0x0002
	fgCyan      WORD = 0x0003
	fgRed       WORD = 0x0004
	fgMagenta   WORD = 0x0005
	fgYellow    WORD = 0x0006
	fgWhite     WORD = 0x0007
	fgIntensity WORD = 0x0008
	fgMask      WORD = 0x000F

	bgBlack     WORD = 0x0000
	bgBlue      WORD = 0x0010
	bgGreen     WORD = 0x0020
	bgCyan      WORD = 0x0030
	bgRed       WORD = 0x0040
	bgMagenta   WORD = 0x0050
	bgYellow    WORD = 0x0060
	bgWhite     WORD = 0x0070
	bgIntensity WORD = 0x0080
	bgMask      WORD = 0x00F0
)

var codesWin = map[byte]WORD{
	0:   fgWhite | bgBlack,       //	"reset":
	1:   fgIntensity,             //CpBold          = CodePair{1, 22}
	22:  fgWhite,                 //	UnBold:        // Just assume this means reset to white fg
	39:  fgWhite,                 //	"resetfg":
	49:  fgWhite,                 //	"resetbg":        // Just assume this means reset to white fg
	30:  fgBlack,                 //	"black":
	31:  fgRed,                   //	"red":
	32:  fgGreen,                 //	"green":
	33:  fgYellow,                //	"yellow":
	34:  fgBlue,                  //	"blue":
	35:  fgMagenta,               //	"magenta":
	36:  fgCyan,                  //	"cyan":
	37:  fgWhite,                 //	"white":
	90:  fgBlack | fgIntensity,   //	"grey":
	91:  fgRed | fgIntensity,     //	"red":
	92:  fgGreen | fgIntensity,   //	"green":
	93:  fgYellow | fgIntensity,  //	"yellow":
	94:  fgBlue | fgIntensity,    //	"blue":
	95:  fgMagenta | fgIntensity, //	"magenta":
	96:  fgCyan | fgIntensity,    //	"cyan":
	97:  fgWhite | fgIntensity,   //	"white":
	40:  bgBlack,                 //	"bgBlack":
	41:  bgRed,                   //	"bgRed":
	42:  bgGreen,                 //	"bgGreen":
	43:  bgYellow,                //	"bgYellow":
	44:  bgBlue,                  //	"bgBlue":
	45:  bgMagenta,               //	"bgMagenta":
	46:  bgCyan,                  //	"bgCyan":
	47:  bgWhite,                 //	"bgWhite":
	100: bgBlack | bgIntensity,   //	"bgBlack":
	101: bgRed | bgIntensity,     //	"bgRed":
	102: bgGreen | bgIntensity,   //	"bgGreen":
	103: bgYellow | bgIntensity,  //	"bgYellow":
	104: bgBlue | bgIntensity,    //	"bgBlue":
	105: bgMagenta | bgIntensity, //	"bgMagenta":
	106: bgCyan | bgIntensity,    //	"bgCyan":
	107: bgWhite | bgIntensity,   //	"bgWhite":
}

// Return our writer so we can override Write()
func OutputWriterFromFile(out *os.File) io.Writer {
	return &ColorWriter{w: out, fd: out.Fd(), mutex: &stdOutMutex, lastFgColor: fgWhite}
}

// Return our writer so we can override Write()
func OutputWriter() io.Writer {
	return OutputWriterFromFile(os.Stdout)
}

// Return our writer so we can override Write()
func ErrorWriter() io.Writer {
	return &ColorWriter{w: os.Stderr, fd: os.Stderr.Fd(), mutex: &stdErrMutex, lastFgColor: fgWhite}
}

type ColorWriter struct {
	w           io.Writer
	fd          uintptr
	mutex       *sync.Mutex
	lastFgColor WORD
	bold        bool
}

// Fd returns the underlying file descriptor. This is mainly to
// support checking whether it's a terminal or not.
func (cw *ColorWriter) Fd() uintptr {
	return cw.fd
}

// Rough emulation of Ansi terminal codes.
// Parse the string, pick out the codes, and convert to
// calls to SetConsoleTextAttribute.
//
// This function must mix calls to SetConsoleTextAttribute
// with separate Write() calls, so to prevent pieces of colored
// strings from being interleaved by unsynchronized goroutines,
// we unfortunately must lock a mutex.
//
// Notice this is only necessary for what is now called
// "legacy" terminal mode:
// https://technet.microsoft.com/en-us/library/mt427362.aspx?f=255&MSPPError=-2147217396
func (cw *ColorWriter) Write(p []byte) (n int, err error) {
	cw.mutex.Lock()
	defer cw.mutex.Unlock()

	var totalWritten = len(p)
	ctlStart := []byte{0x1b, '['}

	for nextIndex := 0; len(p) > 0; {

		// search for the next control code
		nextIndex = bytes.Index(p, ctlStart)
		if nextIndex == -1 {
			nextIndex = len(p)
		}

		cw.w.Write(p[0:nextIndex])
		if nextIndex+2 < len(p) {
			// Skip past the control code
			nextIndex += 2
		}

		p = p[nextIndex:]

		if len(p) > 0 {
			// The control code is written as separate ascii digits. usually 2,
			// ending with 'm'.
			// Stop at 4 as a sanity check.
			if '0' <= p[0] && p[0] <= '9' {
				p = cw.parseColorControl(p)
			} else {
				p = cw.parseControlCode(p)
			}
		}

	}
	return totalWritten, nil
}

func (cw *ColorWriter) parseColorControl(p []byte) []byte {

	var controlIndex int
	controlCode := p[controlIndex] - '0'
	controlIndex++
	for i := 0; controlIndex < len(p) && p[controlIndex] != 'm' && i < 4; i++ {
		if '0' <= p[controlIndex] && p[controlIndex] <= '9' {
			controlCode *= 10
			controlCode += p[controlIndex] - '0'
		}
		controlIndex++
	}

	if code, ok := codesWin[controlCode]; ok {
		if controlCode == 1 {
			// intensity
			cw.bold = true
		} else if controlCode == 0 || controlCode == 22 || controlCode == 39 {
			// reset
			code = fgWhite
			cw.bold = false
		}
		if code >= fgBlue && code <= fgWhite {
			cw.lastFgColor = code
		} else {
			code = cw.lastFgColor
		}
		if cw.bold {
			code = code | fgIntensity
		}
		setConsoleTextAttribute(cw.fd, code)
	}
	if controlIndex+1 <= len(p) {
		controlIndex += 1
	}

	return p[controlIndex:]
}

// parseControlCode is for absorbing backspaces, which
// caused junk tocome out on the console, and whichever
// other control code we're probably unprepared for
func (cw *ColorWriter) parseControlCode(p []byte) []byte {
	if p[0] == 'D' {
		cw.w.Write([]byte(fmt.Sprintf("\b")))
	}
	return p[1:]
}

// setConsoleTextAttribute sets the attributes of characters written to the
// console screen buffer by the WriteFile or WriteConsole function.
// See http://msdn.microsoft.com/en-us/library/windows/desktop/ms686047(v=vs.85).aspx.
func setConsoleTextAttribute(handle uintptr, attribute WORD) error {
	r1, r2, err := setConsoleTextAttributeProc.Call(handle, uintptr(attribute), 0)
	use(attribute)
	return checkError(r1, r2, err)
}

// GetConsoleScreenBufferInfo retrieves information about the specified console screen buffer.
// http://msdn.microsoft.com/en-us/library/windows/desktop/ms683171(v=vs.85).aspx
func getConsoleTextAttribute(handle uintptr) (WORD, error) {
	var info CONSOLE_SCREEN_BUFFER_INFO
	if err := checkError(getConsoleScreenBufferInfoProc.Call(handle, uintptr(unsafe.Pointer(&info)), 0)); err != nil {
		return 0, err
	}
	return info.Attributes, nil
}

// SaveConsoleMode records the current text attributes in a global, so
// it can be restored later, in case nonstandard colors are expected.
func SaveConsoleMode() error {
	var err error
	consoleMode, err = getConsoleTextAttribute(os.Stdout.Fd())
	return err
}

// RestoreConsoleMode restores the current text attributes from a global,
// in case nonstandard colors are expected.
func RestoreConsoleMode() {
	setConsoleTextAttribute(os.Stdout.Fd(), consoleMode)
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
