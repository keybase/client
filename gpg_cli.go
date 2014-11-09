package libkb

import (
	"io"
	"os/exec"
	"sync"
)

type GpgCLI struct {
	path    string
	options []string

	// Configuration --- cache the results
	configured     bool
	configExplicit bool
	configError    error

	mutex *sync.Mutex
}

func NewGpgCLI() *GpgCLI {
	return &GpgCLI{configured: false, mutex: new(sync.Mutex)}
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

	g.path = prog
	g.options = opts
	g.configured = true
	g.configExplicit = configExplicit
	g.configError = err

	return
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

func (g *GpgCLI) Import(k PgpKeyBundle) (err error) {
	arg := RunGpgArg{
		Arguments: []string{"--import"},
		Stdin:     true,
	}
	res := g.Run(arg)
	if res.Err != nil {
		return res.Err
	}

	e1 := k.EncodeToStream(res.Stdin)
	e2 := res.Stdin.Close()
	e3 := res.Wait()
	return PickFirstError(e1, e2, e3)
}

func (g *GpgCLI) Run(arg RunGpgArg) (res RunGpgRes) {

	var args []string
	if g.options != nil {
		args := make([]string, 0, len(g.options))
		copy(args, g.options)
		args = append(args, arg.Arguments...)
	} else {
		args = arg.Arguments
	}

	cmd := exec.Command(g.path, args...)

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
		} else {
			return nil
		}
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
		e1 = DrainPipe(stdout, func(s string) { G.Log.Info(s) })
	}

	if arg.Stderr != nil {
		_, e2 = io.Copy(arg.Stderr, stderr)
	} else {
		e2 = DrainPipe(stderr, func(s string) { G.Log.Warning(s) })
	}

	if !arg.Stdin {
		e3 = waitfn()
	}

	res.Err = PickFirstError(e1, e2, e3)
	return
}
