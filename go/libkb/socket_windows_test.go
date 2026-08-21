// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build windows

package libkb

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func setupTest(t *testing.T, nm string) *TestContext {
	tc := SetupTest(t, nm, 1)
	tc.SetRuntimeDir(filepath.Join(tc.Tp.Home, "socket_windows_test"))
	if err := tc.G.ConfigureSocketInfo(); err != nil {
		require.NoError(t, err)
	}
	return &tc
}

// It would be better to test across process boundaries, but this is better
// than nothing: across gofuncs. We start a server func, then send it a string,
// then synchronize with the server func.
//
// Another property of named pipes that is NOT tested here is security:
// only processes in the same user account are supposed to be able to
// open each other's named pipes.
func TestWindowsNamedPipe(t *testing.T) {
	tc := setupTest(t, "socket_windows_test")
	defer tc.Cleanup()

	listenSocket, err := NewSocket(tc.G)
	require.NoError(t, err)

	l, err := listenSocket.BindToSocket()
	require.NoError(t, err)

	// Do the server listening in a separate gofunc, which we synchronize
	// with later after it has gotten a string
	var wg sync.WaitGroup
	serverErrCh := make(chan error, 1)
	wg.Add(1)
	go func() {
		defer wg.Done()
		conn, err := l.Accept()
		if err != nil {
			serverErrCh <- err
			return
		}
		answer, err := bufio.NewReader(conn).ReadString('\n')
		if err != nil {
			serverErrCh <- err
			return
		}
		if answer != "Hi server!\n" {
			serverErrCh <- fmt.Errorf("Bad response over pipe: -%s-", answer)
			return
		}
		serverErrCh <- nil
	}()

	sendSocket, err := NewSocket(tc.G)
	if err != nil {
		_ = l.Close()
		wg.Wait()
		require.NoError(t, err)
		return
	}
	clientErr := namedPipeClient(sendSocket)
	if clientErr != nil {
		_ = l.Close()
	}
	wg.Wait()
	require.NoError(t, clientErr)
	require.NoError(t, <-serverErrCh)
}

// Dial the server over the pipe and send a string
func namedPipeClient(sendSocket Socket) error {
	conn, err := sendSocket.DialSocket()
	if err != nil {
		return err
	}
	_, err = fmt.Fprintln(conn, "Hi server!")
	return err
}

func TestWindowsPipeOwner(t *testing.T) {
	if os.Getenv("JENKINS_URL") != "" {
		t.Skip("Skipping pipeowner test - doesn't work on CI, works locally")
	}

	tc := setupTest(t, "socket_windows_test")
	defer tc.Cleanup()

	testPipeName := "\\\\.\\pipe\\kbservice\\test_pipe"
	serverCmd := exec.Command("go", "run", "testfixtures\\kb_pipetest_server\\main.go", testPipeName)
	err := serverCmd.Start()
	require.NoError(t, err)
	defer serverCmd.Process.Kill()

	for i := 0; i < 20; i++ {
		// Give the server time to open the pipe
		time.Sleep(500 * time.Millisecond)

		// Test existing pipe
		owner, err := IsPipeowner(tc.G.Log, testPipeName)
		if err != nil {
			if i < 19 {
				continue
			}
			require.FailNow(t, fmt.Sprint(err))
		}
		require.True(t, owner.IsOwner,
			errors.New("Expected true getting owner of test pipe"))
	}

	// Test nonexisting
	owner, err := IsPipeowner(tc.G.Log, testPipeName+"_nonexistent")
	require.Error(t, err,
		errors.New("Expected error getting owner of nonexistent pipe"))
	require.False(t, owner.IsOwner,
		errors.New("Expected false getting owner of nonexistent pipe"))
}
