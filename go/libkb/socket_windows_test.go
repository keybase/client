// +build windows

package libkb

import (
	"bufio"
	"fmt"
	"sync"
	"testing"

	"github.com/keybase/client/go/logger"
)

// It would be better to test across process boundaries, but this is better
// than nothing: across gofuncs. We start a server func, then send it a string,
// then synchronize with the server func.
//
// Another property of named pipes that is NOT tested here is security:
// only processes in the same user account are supposed to be able to
// open each others' named pipes.
func TestWindowsNamedPipe(t *testing.T) {

	var testContext = GlobalContext{
		Log: logger.New("socket_windows_test"),
	}

	listenSocket, err := NewSocket(&testContext)
	if err != nil {
		t.Fatal(err)
	}

	l, err := listenSocket.BindToSocket()
	if err != nil {
		t.Fatal(err)
	}

	// Do the server listening in a separate gofunc, which we synchronize
	// with later after it has gotten a string
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		conn, err := l.Accept()
		if err != nil {
			t.Fatal(err)
		}
		answer, err := bufio.NewReader(conn).ReadString('\n')
		if err != nil {
			t.Fatal(err)
		}
		if answer != "Hi server!\n" {
			t.Fatalf("Bad response over pipe: -%s-", answer)
		}
	}()

	sendSocket, err := NewSocket(&testContext)
	namedPipeClient(sendSocket, t)
	wg.Wait()
}

// Dial the server over the pipe and send a string
func namedPipeClient(sendSocket Socket, t *testing.T) {
	conn, err := sendSocket.DialSocket()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := fmt.Fprintln(conn, "Hi server!"); err != nil {
		t.Fatal(err)
	}
}
