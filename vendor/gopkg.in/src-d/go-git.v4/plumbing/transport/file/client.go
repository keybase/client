// Package file implements the file transport protocol.
package file

import (
	"io"
	"os"
	"os/exec"

	"gopkg.in/src-d/go-git.v4/plumbing/transport"
	"gopkg.in/src-d/go-git.v4/plumbing/transport/internal/common"
)

// DefaultClient is the default local client.
var DefaultClient = NewClient(
	transport.UploadPackServiceName,
	transport.ReceivePackServiceName,
)

type runner struct {
	UploadPackBin  string
	ReceivePackBin string
}

// NewClient returns a new local client using the given git-upload-pack and
// git-receive-pack binaries.
func NewClient(uploadPackBin, receivePackBin string) transport.Transport {
	return common.NewClient(&runner{
		UploadPackBin:  uploadPackBin,
		ReceivePackBin: receivePackBin,
	})
}

func (r *runner) Command(cmd string, ep transport.Endpoint, auth transport.AuthMethod) (common.Command, error) {
	switch cmd {
	case transport.UploadPackServiceName:
		cmd = r.UploadPackBin
	case transport.ReceivePackServiceName:
		cmd = r.ReceivePackBin
	}

	if _, err := exec.LookPath(cmd); err != nil {
		return nil, err
	}

	return &command{cmd: exec.Command(cmd, ep.Path())}, nil
}

type command struct {
	cmd          *exec.Cmd
	stderrCloser io.Closer
	closed       bool
}

func (c *command) Start() error {
	return c.cmd.Start()
}

func (c *command) StderrPipe() (io.Reader, error) {
	// Pipe returned by Command.StderrPipe has a race with Read + Command.Wait.
	// We use an io.Pipe and close it after the command finishes.
	r, w := io.Pipe()
	c.cmd.Stderr = w
	c.stderrCloser = r
	return r, nil
}

func (c *command) StdinPipe() (io.WriteCloser, error) {
	return c.cmd.StdinPipe()
}

func (c *command) StdoutPipe() (io.Reader, error) {
	return c.cmd.StdoutPipe()
}

// Close waits for the command to exit.
func (c *command) Close() error {
	if c.closed {
		return nil
	}

	defer func() {
		c.closed = true
		_ = c.stderrCloser.Close()
	}()

	err := c.cmd.Wait()
	if _, ok := err.(*os.PathError); ok {
		return nil
	}

	// When a repository does not exist, the command exits with code 128.
	if _, ok := err.(*exec.ExitError); ok {
		return nil
	}

	return err
}
