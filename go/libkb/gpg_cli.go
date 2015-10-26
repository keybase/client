package libkb

import (
	"bytes"
	"fmt"
	"io"
	"os/exec"
	"sync"
)

type GpgCLI struct {
	path    string
	options []string

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
		mutex: new(sync.Mutex),
		logUI: logUI,
	}
}

func (g *GpgCLI) Configure() (err error) {

	g.mutex.Lock()
	defer g.mutex.Unlock()

	prog := G.Env.GetGpg()
	opts := G.Env.GetGpgOptions()

	if len(prog) > 0 {
		err = canExec(prog)
	} else {
		prog, err = exec.LookPath("gpg2")
		if err != nil {
			prog, err = exec.LookPath("gpg")
		}
	}
	if err != nil {
		return err
	}

	g.logUI.Debug("| configured GPG w/ path: %s", prog)

	g.path = prog
	g.options = opts

	return
}

// CanExec returns true if a gpg executable exists.
func (g *GpgCLI) CanExec() (bool, error) {
	if err := g.Configure(); err != nil {
		if oerr, ok := err.(*exec.Error); ok {
			if oerr.Err == exec.ErrNotFound {
				return false, nil
			}
		}
		return false, err
	}
	return true, nil
}

// Path returns the path of the gpg executable.
// Path is only available if CanExec() is true.
func (g *GpgCLI) Path() string {
	canExec, err := g.CanExec()
	if err == nil && canExec {
		return g.path
	}
	return ""
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

func (g *GpgCLI) ImportKey(secret bool, fp PGPFingerprint) (*PGPKeyBundle, error) {
	var cmd string
	var which string
	if secret {
		cmd = "--export-secret-key"
		which = "secret "
	} else {
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

	// Convert to posix style on windows
	armored = PosixLineEndings(armored)

	if err := res.Wait(); err != nil {
		return nil, err
	}

	if len(armored) == 0 {
		return nil, NoKeyError{fmt.Sprintf("No %skey found for fingerprint %s", which, fp)}
	}

	bundle, err := ReadOneKeyFromString(armored)
	if err != nil {
		return nil, err
	}

	// For secret keys, *also* import the key in public mode, and then grab the
	// ArmoredPublicKey from that. That's because the public import goes out of
	// its way to preserve the exact armored string from GPG.
	if secret {
		publicBundle, err := g.ImportKey(false, fp)
		if err != nil {
			return nil, err
		}
		bundle.ArmoredPublicKey = publicBundle.ArmoredPublicKey
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
			ch <- DrainPipe(stderr, func(s string) { g.logUI.Info(s) })
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
