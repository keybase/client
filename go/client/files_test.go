// TODO add tests for the rest of the functions in files.go

package client

import (
	"fmt"
	"testing"
)

func TestWriterLocksOnErr(t *testing.T) {
	w := &EscapedSink{Sink: &mockSink{}}

	a := []byte("test")

	if n, err := w.Write(a); n != len(a) || err != nil {
		t.Logf("Write returned unexpected output: %#v, %#v \n", n, err)
		t.Fail()
	}

	// This write should fail, as the mock writer errors
	if n, err := w.Write(a); n != 0 || err == nil {
		t.Logf("Write returned unexpected output: %#v, %#v \n", n, err)
		t.Fail()
	}

	// This write should fail, even if the mock writer would allow it
	if n, err := w.Write(a); n != 0 || err == nil {
		t.Logf("Write returned unexpected output: %#v, %#v \n", n, err)
		t.Fail()
	}
}

// Allows even Write calls, errors on odd calls
type mockSink struct {
	i int
}

func (m *mockSink) Write(p []byte) (n int, err error) {
	if m.i == 0 {
		m.i++
		return len(p), nil
	}

	m.i--
	return 1, fmt.Errorf("error writing")
}

func (m *mockSink) Open() (err error) {
	return nil
}

func (m *mockSink) Close() (err error) {
	return nil
}

func (m *mockSink) HitError(e error) (err error) {
	return nil
}
