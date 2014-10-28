package libkb

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
)

//
// some borrowed from here:
//
//  https://github.com/bradfitz/camlistore/blob/master/pkg/misc/pinentry/pinentry.go
//
// Under the Apache 2.0 license
//

type Pinentry struct {
	initRes *error
	path    string
	term    string
	tty     string
}

func NewPinentry() *Pinentry {
	return &Pinentry{path: ""}
}

func (pe *Pinentry) Init() (error, error) {
	if pe.initRes != nil {
		return *pe.initRes, nil
	}
	err, fatalerr := pe.FindProgram()
	if err == nil {
		err = pe.GetTerminalName()
	}
	pe.term = os.Getenv("TERM")
	pe.initRes = &err
	return err, fatalerr
}

func (pe *Pinentry) SetInitError(e error) {
	pe.initRes = &e
}

func (pe *Pinentry) FindProgram() (error, error) {
	prog := G.Env.GetPinentry()
	var err, fatalerr error
	if len(prog) > 0 {
		if err = canExec(prog); err == nil {
			pe.path = prog
		} else {
			err = fmt.Errorf("Can't execute given pinentry program '%s': %s",
				prog, err.Error())
			fatalerr = err
		}
	} else if prog, err = FindPinentry(); err == nil {
		pe.path = prog
	}
	return err, fatalerr
}

func (pe *Pinentry) GetTerminalName() error {
	tty, err := os.Readlink("/proc/self/fd/0")
	if err != nil {
		G.Log.Debug("| Can't find terminal name via /proc lookup: %s", err.Error())
	} else {
		G.Log.Debug("| found tty=%s", tty)
		pe.tty = tty
	}
	// Tis not a fatal error.  In particular, it won't work on OSX
	return nil
}

func (pe *Pinentry) Get(arg SecretEntryArg) (res *SecretEntryRes, err error) {

	G.Log.Debug("+ Pinentry::Get()")

	// Do a lazy initialization
	if err, _ = pe.Init(); err != nil {
		return
	}

	inst := pinentryInstance{parent: pe}
	defer inst.Close()

	if err = inst.Init(); err != nil {
		// We probably shouldn't try to use this thing again if we failed
		// to set it up.
		pe.SetInitError(err)
		return
	}
	res, err = inst.Run(arg)
	G.Log.Debug("- Pinentry::Get() -> %s", ErrToOk(err))
	return
}

func (pi *pinentryInstance) Close() {
	pi.stdin.Close()
	pi.cmd.Wait()
}

type pinentryInstance struct {
	parent *Pinentry
	cmd    *exec.Cmd
	stdout io.ReadCloser
	stdin  io.WriteCloser
	br     *bufio.Reader
}

func (pi *pinentryInstance) Set(cmd, val string, errp *error) {
	if val == "" {
		return
	}
	fmt.Fprintf(pi.stdin, "%s %s\n", cmd, val)
	line, _, err := pi.br.ReadLine()
	if err != nil {
		*errp = err
		return
	}
	if string(line) != "OK" {
		*errp = fmt.Errorf("Response to " + cmd + " was " + string(line))
	}
	return
}

func (pi *pinentryInstance) Init() (err error) {

	parent := pi.parent

	G.Log.Debug("+ pinentryInstance::Init()")

	pi.cmd = exec.Command(parent.path)
	pi.stdin, _ = pi.cmd.StdinPipe()
	pi.stdout, _ = pi.cmd.StdoutPipe()

	if err = pi.cmd.Start(); err != nil {
		G.Log.Error("unexpected error running pinentry (%s): %s",
			parent.path, err.Error())
		return
	}

	pi.br = bufio.NewReader(pi.stdout)
	lineb, _, err := pi.br.ReadLine()

	if err != nil {
		err = fmt.Errorf("Failed to get getpin greeting: %s", err.Error())
		return
	}

	line := string(lineb)
	if !strings.HasPrefix(line, "OK") {
		err = fmt.Errorf("getpin greeting didn't say 'OK', said: %q", line)
		return
	}

	if len(parent.tty) > 0 {
		pi.Set("OPTION", "ttyname="+parent.tty, &err)
	}
	if len(parent.term) > 0 {
		pi.Set("OPTION", "ttytype="+parent.term, &err)
	}

	G.Log.Debug("- pinentryInstance::Init() -> %s", ErrToOk(err))
	return
}

func descEncode(s string) string {
	s = strings.Replace(s, "%", "%%", -1)
	s = strings.Replace(s, "\n", "%0A", -1)
	return s
}

func (pi *pinentryInstance) Run(arg SecretEntryArg) (res *SecretEntryRes, err error) {

	pi.Set("SETPROMPT", arg.Prompt, &err)
	pi.Set("SETDESC", descEncode(arg.Desc), &err)
	pi.Set("SETOK", arg.OK, &err)
	pi.Set("SETCANCEL", arg.Cancel, &err)
	pi.Set("SETERROR", arg.Error, &err)

	if err != nil {
		return
	}

	fmt.Fprintf(pi.stdin, "GETPIN\n")
	var lineb []byte
	lineb, _, err = pi.br.ReadLine()
	if err != nil {
		err = fmt.Errorf("Failed to read line after GETPIN: %v", err)
		return
	}
	line := string(lineb)
	if strings.HasPrefix(line, "D ") {
		res = &SecretEntryRes{Text: line[2:]}
	} else if strings.HasPrefix(line, "ERR 83886179 canceled") {
		res = &SecretEntryRes{Canceled: true}
	} else if line == "OK" {
		res = &SecretEntryRes{}
	} else {
		err = fmt.Errorf("GETPIN response didn't start with D; got %q", line)
	}

	return
}
