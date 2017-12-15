// +build openbsd

package ps

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFindProcessOpenBSD(t *testing.T) {
	proc := testFindProcess(t, "go-ps.test")
	assert.True(t, proc.PPid() > 0)
}

func TestProcessesOpenBSD(t *testing.T) {
	testProcesses(t, "go")
}

/*
// Currently querying for -1 will return -1 :P

func TestProcessesOpenBSDError(t *testing.T) {
	proc, err := findProcess(-1)
	assert.Nil(t, proc)
	assert.Nil(t, err)
}
*/
