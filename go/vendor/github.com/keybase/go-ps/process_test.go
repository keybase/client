package ps

import (
	"errors"
	"os"
	"runtime"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testFindProcess(t *testing.T, name string) Process {
	proc, err := FindProcess(os.Getpid())
	require.NoError(t, err)
	require.NotNil(t, proc)
	assert.Equal(t, os.Getpid(), proc.Pid())

	if name != "" {
		assert.Equal(t, name, proc.Executable())
		path, err := proc.Path()
		require.NoError(t, err)
		t.Logf("Path: %s", path)
		assert.True(t, strings.HasSuffix(path, string(os.PathSeparator)+name))

	}
	return proc
}

func testProcesses(t *testing.T, name string) {
	// This test works because there will always be SOME processes running
	procs, err := Processes()
	require.NoError(t, err)
	require.True(t, len(procs) > 0)

	if name != "" {
		found := false
		for _, p := range procs {
			if p.Executable() == name {
				found = true
				break
			}
		}
		assert.True(t, found)
	}
}

func TestFindProcess(t *testing.T) {
	testFindProcess(t, "")
}

func TestFindProcessGo(t *testing.T) {
	var exe = "go-ps.test"
	if runtime.GOOS == "windows" {
		exe += ".exe"
	}
	testFindProcess(t, exe)
}

func TestProcesses(t *testing.T) {
	testProcesses(t, "")
}

func TestFindProcessesWithFnError(t *testing.T) {
	ps, err := findProcessesWithFn(func() ([]Process, error) { return nil, errors.New("TestFindProcessesWithFn Error") }, nil, 0)
	require.Nil(t, ps)
	require.NotNil(t, err)
	ps, err = findProcessesWithFn(func() ([]Process, error) { return nil, nil }, nil, 0)
	require.Nil(t, ps)
	require.Nil(t, err)
}
