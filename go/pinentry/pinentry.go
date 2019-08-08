// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pinentry

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	prog    string
	log     logger.Logger
}

func New(envprog string, log logger.Logger, tty string) *Pinentry {
	return &Pinentry{
		prog: envprog,
		log:  log,
		tty:  tty,
	}
}

func (pe *Pinentry) Init() (error, error) {
	if pe.initRes != nil {
		return *pe.initRes, nil
	}
	err, fatalerr := pe.FindProgram()
	if err == nil {
		pe.GetTerminalName()
	}
	pe.term = os.Getenv("TERM")
	pe.initRes = &err
	return err, fatalerr
}

func (pe *Pinentry) SetInitError(e error) {
	pe.initRes = &e
}

func (pe *Pinentry) FindProgram() (error, error) {
	prog := pe.prog
	var err, fatalerr error
	if len(prog) > 0 {
		if err = canExec(prog); err == nil {
			pe.path = prog
		} else {
			err = fmt.Errorf("Can't execute given pinentry program '%s': %s",
				prog, err)
			fatalerr = err
		}
	} else if prog, err = FindPinentry(pe.log); err == nil {
		pe.path = prog
	}
	return err, fatalerr
}

func (pe *Pinentry) Get(arg keybase1.SecretEntryArg) (res *keybase1.SecretEntryRes, err error) {

	pe.log.Debug("+ Pinentry::Get()")

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
	pe.log.Debug("- Pinentry::Get() -> %v", err)
	return
}

func (pi *pinentryInstance) Close() {
	pi.stdin.Close()
	_ = pi.cmd.Wait()
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
}

func (pi *pinentryInstance) Init() (err error) {
	parent := pi.parent

	parent.log.Debug("+ pinentryInstance::Init()")

	pi.cmd = exec.Command(parent.path)
	pi.stdin, _ = pi.cmd.StdinPipe()
	pi.stdout, _ = pi.cmd.StdoutPipe()

	if err = pi.cmd.Start(); err != nil {
		parent.log.Warning("unexpected error running pinentry (%s): %s", parent.path, err)
		return
	}

	pi.br = bufio.NewReader(pi.stdout)
	lineb, _, err := pi.br.ReadLine()

	if err != nil {
		err = fmt.Errorf("Failed to get getpin greeting: %s", err)
		return
	}

	line := string(lineb)
	if !strings.HasPrefix(line, "OK") {
		err = fmt.Errorf("getpin greeting didn't say 'OK', said: %q", line)
		return
	}

	if len(parent.tty) > 0 {
		parent.log.Debug("setting ttyname to %s", parent.tty)
		pi.Set("OPTION", "ttyname="+parent.tty, &err)
		if err != nil {
			parent.log.Debug("error setting ttyname: %s", err)
		}
	}
	if len(parent.term) > 0 {
		parent.log.Debug("setting ttytype to %s", parent.term)
		pi.Set("OPTION", "ttytype="+parent.term, &err)
		if err != nil {
			parent.log.Debug("error setting ttytype: %s", err)
		}
	}

	parent.log.Debug("- pinentryInstance::Init() -> %v", err)
	return
}

func descEncode(s string) string {
	s = strings.Replace(s, "%", "%%", -1)
	s = strings.Replace(s, "\n", "%0A", -1)
	return s
}

func resDecode(s string) string {
	s = strings.Replace(s, "%25", "%", -1)
	return s
}

func (pi *pinentryInstance) Run(arg keybase1.SecretEntryArg) (res *keybase1.SecretEntryRes, err error) {

	pi.Set("SETPROMPT", arg.Prompt, &err)
	pi.Set("SETDESC", descEncode(arg.Desc), &err)
	pi.Set("SETOK", arg.Ok, &err)
	pi.Set("SETCANCEL", arg.Cancel, &err)
	pi.Set("SETERROR", arg.Err, &err)

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
	switch {
	case strings.HasPrefix(line, "D "):
		res = &keybase1.SecretEntryRes{Text: resDecode(line[2:])}
	case strings.HasPrefix(line, "ERR 83886179 canceled") || strings.HasPrefix(line, "ERR 83886179 Operation cancelled"):
		res = &keybase1.SecretEntryRes{Canceled: true}
	case line == "OK":
		res = &keybase1.SecretEntryRes{}
	default:
		return nil, fmt.Errorf("GETPIN response didn't start with D; got %q", line)
	}

	return
}
