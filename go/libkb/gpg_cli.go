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

func (g *GpgCLI) Configure(mctx MetaContext) (err error) {

	g.mutex.Lock()
	defer g.mutex.Unlock()

	prog := g.G().Env.GetGpg()
	opts := g.G().Env.GetGpgOptions()

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

	mctx.Debug("| configured GPG w/ path: %s", prog)

	g.path = prog
	g.options = opts

	return
}

// CanExec returns true if a gpg executable exists.
func (g *GpgCLI) CanExec(mctx MetaContext) (bool, error) {
	err := g.Configure(mctx)
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
func (g *GpgCLI) Path(mctx MetaContext) string {
	canExec, err := g.CanExec(mctx)
	if err == nil && canExec {
		return g.path
	}
	return ""
}

func (g *GpgCLI) ImportKeyArmored(mctx MetaContext, secret bool, fp PGPFingerprint, tty string) (string, error) {
	g.outputVersion(mctx)
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

	res := g.Run2(mctx, arg)
	if res.Err != nil {
		return "", res.Err
	}

	buf := new(bytes.Buffer)
	_, err := buf.ReadFrom(res.Stdout)
	if err != nil {
		return "", err
	}
	armored := buf.String()

	// Convert to posix style on windows
	armored = PosixLineEndings(armored)

	if err := res.Wait(); err != nil {
		return "", err
	}

	if len(armored) == 0 {
		return "", NoKeyError{fmt.Sprintf("No %skey found for fingerprint %s", which, fp)}
	}

	return armored, nil
}

func (g *GpgCLI) ImportKey(mctx MetaContext, secret bool, fp PGPFingerprint, tty string) (*PGPKeyBundle, error) {

	armored, err := g.ImportKeyArmored(mctx, secret, fp, tty)
	if err != nil {
		return nil, err
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
		publicBundle, err := g.ImportKey(mctx, false, fp, tty)
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

func (g *GpgCLI) ExportKeyArmored(mctx MetaContext, s string) (err error) {
	g.outputVersion(mctx)
	arg := RunGpg2Arg{
		Arguments: []string{"--import"},
		Stdin:     true,
	}
	res := g.Run2(mctx, arg)
	if res.Err != nil {
		return res.Err
	}
	_, err = res.Stdin.Write([]byte(s))
	if err != nil {
		return err
	}
	err = res.Stdin.Close()
	if err != nil {
		return err
	}
	err = res.Wait()
	return err
}

func (g *GpgCLI) ExportKey(mctx MetaContext, k PGPKeyBundle, private bool, batch bool) (err error) {
	g.outputVersion(mctx)
	arg := RunGpg2Arg{
		Arguments: []string{"--import"},
		Stdin:     true,
	}

	if batch {
		arg.Arguments = append(arg.Arguments, "--batch")
	}

	res := g.Run2(mctx, arg)
	if res.Err != nil {
		return res.Err
	}

	e1 := k.EncodeToStream(res.Stdin, private)
	e2 := res.Stdin.Close()
	e3 := res.Wait()
	return PickFirstError(e1, e2, e3)
}

func (g *GpgCLI) Sign(mctx MetaContext, fp PGPFingerprint, payload []byte) (string, error) {
	g.outputVersion(mctx)
	arg := RunGpg2Arg{
		Arguments: []string{"--armor", "--sign", "-u", fp.String()},
		Stdout:    true,
		Stdin:     true,
	}

	res := g.Run2(mctx, arg)
	if res.Err != nil {
		return "", res.Err
	}

	_, err := res.Stdin.Write(payload)
	if err != nil {
		return "", err
	}
	res.Stdin.Close()

	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(res.Stdout)
	if err != nil {
		return "", err
	}
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

func (g *GpgCLI) outputVersion(mctx MetaContext) {
	v, err := g.Version()
	if err != nil {
		mctx.Debug("error getting GPG version: %s", err)
		return
	}
	mctx.Debug("GPG version:\n%s", v)
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

func (g *GpgCLI) Run2(mctx MetaContext, arg RunGpg2Arg) (res RunGpg2Res) {
	if g.path == "" {
		res.Err = errors.New("no gpg path set")
		return
	}

	cmd := g.MakeCmd(mctx, arg.Arguments, arg.TTY)

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

	bgmctx := mctx.BackgroundWithLogTags()
	if !arg.Stdout {
		out++
		go func() {
			ch <- DrainPipe(stdout, func(s string) { bgmctx.Debug(s) })
		}()
	} else {
		res.Stdout = stdout
	}

	if !arg.Stderr {
		out++
		go func() {
			ch <- DrainPipe(stderr, func(s string) { bgmctx.Debug(s) })
		}()
	} else {
		res.Stderr = stderr
	}

	return
}

func (g *GpgCLI) MakeCmd(mctx MetaContext, args []string, tty string) *exec.Cmd {
	var nargs []string
	if g.options != nil {
		nargs = make([]string, len(g.options))
		copy(nargs, g.options)
		nargs = append(nargs, args...)
	} else {
		nargs = args
	}
	// Always use --no-auto-check-trustdb to prevent gpg from refreshing trustdb.
	// Refreshing the trustdb can cause hangs when bad keys from CVE-2019-13050 are in the keyring.
	// --no-auto-check-trustdb was introduced around gpg 1.0 so ought to always be implemented.
	nargs = append([]string{"--no-auto-check-trustdb"}, nargs...)
	if g.G().Service {
		nargs = append([]string{"--no-tty"}, nargs...)
	}
	mctx.Debug("| running Gpg: %s %s", g.path, strings.Join(nargs, " "))
	ret := exec.Command(g.path, nargs...)
	if tty == "" {
		tty = g.tty
	}
	if tty != "" {
		ret.Env = append(os.Environ(), "GPG_TTY="+tty)
		mctx.Debug("| setting GPG_TTY=%s", tty)
	} else {
		mctx.Debug("| no tty provided, GPG_TTY will not be changed")
	}
	return ret
}
