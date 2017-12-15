// +build windows

package ps

import (
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFindProcessWindows(t *testing.T) {
	proc := testFindProcess(t, "go-ps.test.exe")
	assert.True(t, proc.PPid() > 0)
}

func TestProcessesWindows(t *testing.T) {
	testProcesses(t, "go.exe")
}

func TestProcessesWindowsError(t *testing.T) {
	errFn := func() ([]Process, error) {
		return nil, fmt.Errorf("oops")
	}
	proc, err := findProcessWithFn(errFn, os.Getpid())
	assert.Nil(t, proc)
	assert.EqualError(t, err, "Error listing processes: oops")
}
