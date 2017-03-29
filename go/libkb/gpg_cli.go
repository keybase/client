// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"

	"github.com/blang/semver"
)

type GpgCLI struct {
	Contextified
	path    string
	options []string
	version string
	tty     string

	mutex *sync.Mutex

	logUI LogUI
}

func NewGpgCLI(g *GlobalContext, logUI LogUI) *GpgCLI {
	if logUI == nil {
		logUI = g.Log
	}
	return &GpgCLI{
		Contextified: NewContextified(g),
		mutex:        new(sync.Mutex),
		logUI:        logUI,
	}
}

func (g *GpgCLI) SetTTY(t string) {
	g.tty = t
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
	err := g.Configure()
	if IsExecError(err) {
		return false, nil
	}
	if err != nil {
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

func (g *GpgCLI) ImportKey(secret bool, fp PGPFingerprint, tty string) (*PGPKeyBundle, error) {
	g.outputVersion()
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
		TTY:       tty,
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

	bundle, w, err := ReadOneKeyFromString(armored)
	w.Warn(g.G())
	if err != nil {
		return nil, err
	}

	// For secret keys, *also* import the key in public mode, and then grab the
	// ArmoredPublicKey from that. That's because the public import goes out of
	// its way to preserve the exact armored string from GPG.
	if secret {
		publicBundle, err := g.ImportKey(false, fp, tty)
		if err != nil {
			return nil, err
		}
		bundle.ArmoredPublicKey = publicBundle.ArmoredPublicKey

		// It's a bug that gpg --export-secret-keys doesn't grep subkey revocations.
		// No matter, we have both in-memory, so we can copy it over here
		bundle.CopySubkeyRevocations(publicBundle.Entity)
	}

	return bundle, nil
}

func (g *GpgCLI) ExportKey(k PGPKeyBundle, private bool) (err error) {
	g.outputVersion()
	arg := RunGpg2Arg{
		Arguments: []string{"--import"},
		Stdin:     true,
	}

	res := g.Run2(arg)
	if res.Err != nil {
		return res.Err
	}

	e1 := k.EncodeToStream(res.Stdin, private)
	e2 := res.Stdin.Close()
	e3 := res.Wait()
	return PickFirstError(e1, e2, e3)
}

func (g *GpgCLI) Sign(fp PGPFingerprint, payload []byte) (string, error) {
	g.outputVersion()
	arg := RunGpg2Arg{
		Arguments: []string{"--armor", "--sign", "-u", fp.String()},
		Stdout:    true,
		Stdin:     true,
	}

	res := g.Run2(arg)
	if res.Err != nil {
		return "", res.Err
	}

	res.Stdin.Write(payload)
	res.Stdin.Close()

	buf := new(bytes.Buffer)
	buf.ReadFrom(res.Stdout)
	armored := buf.String()

	// Convert to posix style on windows
	armored = PosixLineEndings(armored)

	if err := res.Wait(); err != nil {
		return "", err
	}

	return armored, nil
}

func (g *GpgCLI) Version() (string, error) {
	if len(g.version) > 0 {
		return g.version, nil
	}

	args := append(g.options, "--version")
	out, err := exec.Command(g.path, args...).Output()
	if err != nil {
		return "", err
	}
	g.version = string(out)
	return g.version, nil
}

func (g *GpgCLI) outputVersion() {
	v, err := g.Version()
	if err != nil {
		g.logUI.Debug("error getting GPG version: %s", err)
		return
	}
	g.logUI.Debug("GPG version:\n%s", v)
}

func (g *GpgCLI) SemanticVersion() (*semver.Version, error) {
	out, err := g.Version()
	if err != nil {
		return nil, err
	}
	lines := strings.Split(out, "\n")
	if len(lines) == 0 {
		return nil, errors.New("empty gpg version")
	}
	parts := strings.Fields(lines[0])
	if len(parts) < 3 {
		return nil, fmt.Errorf("unhandled gpg version output %q full: %q", lines[0], lines)
	}
	return semver.New(parts[2])
}

func (g *GpgCLI) VersionAtLeast(s string) (bool, error) {
	min, err := semver.New(s)
	if err != nil {
		return false, err
	}
	cur, err := g.SemanticVersion()
	if err != nil {
		return false, err
	}
	return cur.GTE(*min), nil
}

type RunGpg2Arg struct {
	Arguments []string
	Stdin     bool
	Stderr    bool
	Stdout    bool
	TTY       string
}

type RunGpg2Res struct {
	Stdin  io.WriteCloser
	Stdout io.ReadCloser
	Stderr io.ReadCloser
	Wait   func() error
	Err    error
}

func (g *GpgCLI) Run2(arg RunGpg2Arg) (res RunGpg2Res) {
	if g.path == "" {
		res.Err = errors.New("no gpg path set")
		return
	}

	cmd := g.MakeCmd(arg.Arguments, arg.TTY)

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
			ch <- DrainPipe(stdout, func(s string) { g.logUI.Debug(s) })
		}()
	} else {
		res.Stdout = stdout
	}

	if !arg.Stderr {
		out++
		go func() {
			ch <- DrainPipe(stderr, func(s string) { g.logUI.Debug(s) })
		}()
	} else {
		res.Stderr = stderr
	}

	return
}

func (g *GpgCLI) MakeCmd(args []string, tty string) *exec.Cmd {
	var nargs []string
	if g.options != nil {
		nargs = make([]string, len(g.options))
		copy(nargs, g.options)
		nargs = append(nargs, args...)
	} else {
		nargs = args
	}
	if g.G().Service {
		nargs = append([]string{"--no-tty"}, nargs...)
	}
	g.logUI.Debug("| running Gpg: %s %s", g.path, strings.Join(nargs, " "))
	ret := exec.Command(g.path, nargs...)
	if tty == "" {
		tty = g.tty
	}
	if tty != "" {
		ret.Env = append(os.Environ(), "GPG_TTY="+tty)
		g.logUI.Debug("| setting GPG_TTY=%s", tty)
	} else {
		g.logUI.Debug("| no tty provided, GPG_TTY will not be changed")
	}
	return ret
}
