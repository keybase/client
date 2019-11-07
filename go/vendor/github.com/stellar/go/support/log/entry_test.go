package log

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEntry_StartTest(t *testing.T) {
	var out bytes.Buffer
	e := New()
	e.Logger.Out = &out

	// when in test mode, out gets no output
	done := e.StartTest(WarnLevel)
	e.Warn("hello")
	logged := done()

	assert.Empty(t, out.String())
	if assert.Len(t, logged, 1) {
		assert.Equal(t, "hello", logged[0].Message)
	}

	e.Warn("goodbye")
	assert.Contains(t, out.String(), "goodbye", "output was not logged after test")
}
