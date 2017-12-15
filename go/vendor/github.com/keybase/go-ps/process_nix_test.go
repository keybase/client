// +build darwin linux

package ps

import (
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestProcessExecRun(t *testing.T) {
	procPath, cmd, _ := testExecRun(t)
	defer cleanup(cmd, procPath)
}

func testProcessPath(t *testing.T, procPath string) Process {
	matchPath := func(p Process) bool {
		return matchPath(t, p, procPath)
	}
	procs, err := findProcessesWithFn(processes, matchPath, 1)
	require.NoError(t, err)

	require.Equal(t, 1, len(procs))
	proc := procs[0]
	path, err := proc.Path()
	require.NoError(t, err)
	require.Equal(t, procPath, path)
	return proc
}

func cleanup(cmd *exec.Cmd, procPath string) {
	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
	}
	_ = os.Remove(procPath)
}

func testExecPath(t *testing.T) string {
	// Copy sleep executable to tmp
	procPath := filepath.Join(os.TempDir(), "sleeptest")
	err := copyFile("/bin/sleep", procPath, 0777)
	require.NoError(t, err)
	// Temp dir might have symlinks in which case we need the eval'ed path
	procPath, err = filepath.EvalSymlinks(procPath)
	require.NoError(t, err)
	return procPath
}

func testExecRun(t *testing.T) (string, *exec.Cmd, Process) {
	procPath := testExecPath(t)
	cmd := exec.Command(procPath, "10")
	err := cmd.Start()
	require.NoError(t, err)
	proc := testProcessPath(t, procPath)
	return procPath, cmd, proc
}

func copyFile(sourcePath string, destinationPath string, mode os.FileMode) error {
	in, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer func() { _ = in.Close() }()

	out, err := os.Create(destinationPath)
	if err != nil {
		return err
	}
	defer func() { _ = out.Close() }()
	_, err = io.Copy(out, in)
	closeErr := out.Close()
	if err != nil {
		return err
	}
	err = os.Chmod(destinationPath, mode)
	if err != nil {
		return err
	}
	return closeErr
}

func matchPath(t *testing.T, p Process, match string) bool {
	path, err := p.Path()
	if err != nil {
		t.Logf("Error trying to get path: %s", err)
		return false
	}
	return path == match
}
