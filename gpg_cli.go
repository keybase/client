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

func (g *GpgCLI) Export(k PgpKeyBundle) (err error) {
	opts := []string{"--import"}
	if g.options != nil {
		opts = append(opts, g.options...)
	}
	cmd := exec.Command(g.path, opts...)
	waited := false

	var stdin io.WriteCloser
	var stdout, stderr io.ReadCloser

	if stdin, err = cmd.StdinPipe(); err != nil {
		return
	}
	if stdout, err = cmd.StdoutPipe(); err != nil {
		return
	}
	if stderr, err = cmd.StderrPipe(); err != nil {
		return
	}
	if err = cmd.Start(); err != nil {
		return
	}
	defer func() {
		if !waited {
			cmd.Wait()
		}
	}()

	if err = k.EncodeToStream(stdin); err != nil {
		return
	}

	if err = stdin.Close(); err != nil {
		return
	}

	DrainPipe(stdout, func(s string) { G.Log.Info(s) })
	DrainPipe(stderr, func(s string) { G.Log.Warning(s) })

	err = cmd.Wait()
	waited = true

	if err != nil {
		return
	}

	return nil
}
