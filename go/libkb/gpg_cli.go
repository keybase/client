package libkb

import (
	"bytes"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"sync"

	"golang.org/x/crypto/openpgp"
)

type GpgCLI struct {
	path    string
	options []string

	// Configuration --- cache the results
	configured     bool
	configExplicit bool
	configError    error

	mutex *sync.Mutex

	logUI LogUI
}

type GpgCLIArg struct {
	LogUI LogUI // If nil, use the global
}

func NewGpgCLI(arg GpgCLIArg) *GpgCLI {
	logUI := arg.LogUI
	if logUI == nil {
		logUI = G.Log
	}
	return &GpgCLI{
		configured: false,
		mutex:      new(sync.Mutex),
		logUI:      logUI,
	}
}

func (g *GpgCLI) Configure() (configExplicit bool, err error) {

	g.mutex.Lock()
	defer g.mutex.Unlock()

	if g.configured {
		configExplicit = g.configExplicit
		err = g.configError
		return
	}

	prog := G.Env.GetGpg()
	opts := G.Env.GetGpgOptions()

	// If we asked for any explicit GPG options
	configExplicit = (len(prog) > 0 || opts != nil)
	if len(prog) > 0 {
		err = canExec(prog)
	} else {
		prog, err = exec.LookPath("gpg2")
		if err != nil {
			prog, err = exec.LookPath("gpg")
		}
	}

	g.logUI.Debug("| configured GPG w/ path: %s", prog)

	g.path = prog
	g.options = opts
	g.configured = true
	g.configExplicit = configExplicit
	g.configError = err

	return
}

// CanExec returns true if a gpg executable exists.
func (g *GpgCLI) CanExec() (bool, error) {
	if _, err := g.Configure(); err != nil {
		if oerr, ok := err.(*exec.Error); ok {
			if oerr.Err == exec.ErrNotFound {
				return false, nil
			}
		}
		return false, err
	}
	return true, nil
}

// Path returns the path of the gpg executable.  Configure must be
// called before using this.
func (g *GpgCLI) Path() string {
	if !g.configured {
		panic("GpgCLI not configured")
	}
	return g.path
}

type RunGpgArg struct {
	Arguments []string
	Stdin     bool
	Stderr    io.WriteCloser
	Stdout    io.WriteCloser
}

type RunGpgRes struct {
	Stdin io.WriteCloser
	Err   error
	Wait  func() error
}

func (g *GpgCLI) ImportKey(secret bool, fp PGPFingerprint) (ret *PGPKeyBundle, err error) {
	var cmd string
	var which string
	if secret {
		which = "secret"
		cmd = "--export-secret-key"
	} else {
		which = "public"
		cmd = "--export"
	}

	arg := RunGpg2Arg{
		Arguments: []string{"--armor", cmd, fp.String()},
		Stdout:    true,
	}

	res := g.Run2(arg)
	if res.Err != nil {
		return nil, res.Err
	}

	buf := new(bytes.Buffer)
	buf.ReadFrom(res.Stdout)
	armored := buf.String()

	var el openpgp.EntityList

	if len(armored) != 0 {
		el, err = openpgp.ReadArmoredKeyRing(strings.NewReader(armored))
	}

	if err != nil {
		return nil, err
	}
	if err = res.Wait(); err != nil {
		return nil, err
	}
	if len(el) == 0 {
		return nil, NoKeyError{fmt.Sprintf("No %s key for %s found", which, fp.ToKeyID())}
	}
	if len(el) > 1 {
		return nil, TooManyKeysError{len(el), fp}
	}

	bundle := NewPGPKeyBundle(el[0])
	if !secret {
		bundle.ArmoredPublicKey = armored
	}
	return bundle, nil
}

func (g *GpgCLI) ExportKey(k PGPKeyBundle) (err error) {
	arg := RunGpg2Arg{
		Arguments: []string{"--import"},
		Stdin:     true,
	}

	res := g.Run2(arg)
	if res.Err != nil {
		return res.Err
	}

	e1 := k.EncodeToStream(res.Stdin)
	e2 := res.Stdin.Close()
	e3 := res.Wait()
	return PickFirstError(e1, e2, e3)
}

type RunGpg2Arg struct {
	Arguments []string
	Stdin     bool
	Stderr    bool
	Stdout    bool
}

type RunGpg2Res struct {
	Stdin  io.WriteCloser
	Stdout io.ReadCloser
	Stderr io.ReadCloser
	Wait   func() error
	Err    error
}

func (g *GpgCLI) Run2(arg RunGpg2Arg) (res RunGpg2Res) {

	cmd := g.MakeCmd(arg.Arguments)

	if arg.Stdin {
		if res.Stdin, res.Err = cmd.StdinPipe(); res.Err != nil {
			return
		}
	}

	var stdout, stderr io.ReadCloser

	if stdout, res.Err = cmd.StdoutPipe(); res.Err != nil {
		return
	}
	if stderr, res.Err = cmd.StderrPipe(); res.Err != nil {
		return
	}

	if res.Err = cmd.Start(); res.Err != nil {
		return
	}

	waited := false
	out := 0
	ch := make(chan error)
	var fep FirstErrorPicker

	res.Wait = func() error {
		for out > 0 {
			fep.Push(<-ch)
			out--
		}
		if !waited {
			waited = true
			err := cmd.Wait()
			if err != nil {
				fep.Push(ErrorToGpgError(err))
			}
			return fep.Error()
		}
		return nil
	}

	if !arg.Stdout {
		out++
		go func() {
			ch <- DrainPipe(stdout, func(s string) { g.logUI.Info(s) })
		}()
	} else {
		res.Stdout = stdout
	}

	if !arg.Stderr {
		out++
		go func() {
			ch <- DrainPipe(stderr, func(s string) { g.logUI.Warning(s) })
		}()
	} else {
		res.Stderr = stderr
	}

	return
}

func (g *GpgCLI) MakeCmd(args []string) *exec.Cmd {
	var nargs []string
	if g.options != nil {
		nargs = make([]string, len(g.options))
		copy(nargs, g.options)
		nargs = append(nargs, args...)
	} else {
		nargs = args
	}
	g.logUI.Debug("| running Gpg: %s %v", g.path, nargs)
	return exec.Command(g.path, nargs...)
}

func (g *GpgCLI) Run(arg RunGpgArg) (res RunGpgRes) {

	cmd := g.MakeCmd(arg.Arguments)

	waited := false

	var stdout, stderr io.ReadCloser

	if arg.Stdin {
		if res.Stdin, res.Err = cmd.StdinPipe(); res.Err != nil {
			return
		}
	}
	if stdout, res.Err = cmd.StdoutPipe(); res.Err != nil {
		return
	}
	if stderr, res.Err = cmd.StderrPipe(); res.Err != nil {
		return
	}

	if res.Err = cmd.Start(); res.Err != nil {
		return
	}

	waitfn := func() error {
		if !waited {
			waited = true
			return cmd.Wait()
		}
		return nil
	}

	if arg.Stdin {
		res.Wait = waitfn
	} else {
		defer waitfn()
	}

	var e1, e2, e3 error

	if arg.Stdout != nil {
		_, e1 = io.Copy(arg.Stdout, stdout)
	} else {
		e1 = DrainPipe(stdout, func(s string) { g.logUI.Info(s) })
	}

	if arg.Stderr != nil {
		_, e2 = io.Copy(arg.Stderr, stderr)
	} else {
		e2 = DrainPipe(stderr, func(s string) { g.logUI.Warning(s) })
	}

	if !arg.Stdin {
		e3 = waitfn()
	}

	res.Err = PickFirstError(e1, e2, e3)
	return
}
