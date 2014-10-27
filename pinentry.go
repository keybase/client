package libkb

import (
	"bufio"
	"fmt"
	"io"
	"os/exec"
	"strings"
)

type Pinentry struct {
	initRes *error
	path    string
	term    string
	tty     string
}

func NewPinentry() *Pinentry {
	return &Pinentry{path: ""}
}

func (pe *Pinentry) Init() error {
	if pe.initRes != nil {
		return *pe.initRes
	}
	err := pe.FindProgram()
	if err == nil {
		err = pe.GetTerminalName()
	}
	pe.initRes = &err
	return err
}

func (pe *Pinentry) SetInitError(e error) {
	pe.initRes = &e
}

func (pe *Pinentry) FindProgram() error {
	prog := G.Env.GetPinentry()
	var err error
	if len(prog) > 0 {
		if err := canExec(prog); err == nil {
			pe.path = prog
		} else {
			err = fmt.Errorf("Can't execute given pinentry program '%s': %s",
				prog, err.Error())
		}
	} else if prog, err = FindPinentry(); err == nil {
		pe.path = prog
	}
	return err
}

func (pe *Pinentry) GetTerminalName() error {
	out, err := exec.Command("tty").Output()
	if err != nil {
		return err
	} else if s := string(out); len(s) == 0 {
		return fmt.Errorf("No feasible TTY returned by tty")
	} else {
		pe.tty = s
	}
	return nil
}

type PinentryArg struct {
	Desc   string
	Prompt string
	Error  string
	Cancel string
	OK     string
}

// Eventually we'll learn how to set checkboxes like GPG2 does on
// OSX. But for now, just the string...
type PinentryRes struct {
	Text     string
	Canceled bool
}

func (pe *Pinentry) Get(arg *PinentryArg) (res *PinentryRes, err error) {

	// Do a lazy initialization
	if err = pe.Init(); err != nil {
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
	return
}

func (pi *pinentryInstance) Close() {
	pi.cmd.Wait()
	pi.stdin.Close()
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

	pi.cmd = exec.Command(parent.path)
	pi.stdin, _ = pi.cmd.StdinPipe()
	pi.stdout, _ = pi.cmd.StdoutPipe()

	if err = pi.cmd.Start(); err != nil {
		G.Log.Error("unexpected error running pinentry: %s", err.Error())
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

	pi.Set("OPTION", "ttyname="+parent.tty, &err)
	pi.Set("OPTION", "ttytype="+parent.term, &err)

	return
}

func descEncode(s string) string {
	s = strings.Replace(s, "%", "%%", -1)
	s = strings.Replace(s, "\n", "%0A", -1)
	return s
}

func (pi *pinentryInstance) Run(arg *PinentryArg) (res *PinentryRes, err error) {

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
		res = &PinentryRes{Text: line[2:]}
	} else if strings.HasPrefix(line, "ERR 83886179 canceled") {
		res = &PinentryRes{Canceled: true}
	} else {
		err = fmt.Errorf("GETPIN response didn't start with D; got %q", line)
	}

	return
}
