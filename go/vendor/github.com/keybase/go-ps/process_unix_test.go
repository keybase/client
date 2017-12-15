// +build linux

package ps

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUnixProcess(t *testing.T) {
	var _ Process = new(UnixProcess)
}

func TestProcessesUnixError(t *testing.T) {
	proc, err := findProcess(-1)
	assert.Nil(t, proc)
	assert.Nil(t, err)
}

func TestProcessesUnixPPid(t *testing.T) {
	proc, err := FindProcess(os.Getpid())
	require.NoError(t, err)
	require.NotNil(t, proc)
	assert.Equal(t, os.Getpid(), proc.Pid())
	assert.Equal(t, os.Getppid(), proc.PPid())
}
