// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/dynamodb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/ioutil"
)

const (
	// LocalDynamoDBDownloadURI source: http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Tools.DynamoDBLocal.html
	// We don't use latest because Amazon doesn't offer https downloads of this. So we peg to a revision and verify the hash.
	LocalDynamoDBDownloadURI = "http://dynamodb-local.s3-website-us-west-2.amazonaws.com/dynamodb_local_2016-04-19.tar.gz"
	// LocalDynamoDBSha256Hash is the sha256 hash of the above tar ball.
	LocalDynamoDBSha256Hash = "35bcbf97c1c3ef8607ac0032d6127eae313edd26a73c80fdc230e4d8a14c1c33"
	// LocalDynamoDBTmpDir is relative to the system's own TempDir.
	LocalDynamoDBTmpDir = "dynamodb_local"
	// LocalDynamoDBPidFile contains the process ID.
	LocalDynamoDBPidFile = "dynamodb.pid"
	// LocalDynamoDBJarFile is the name of the local dynamodb server jar file.
	LocalDynamoDBJarFile = "DynamoDBLocal.jar"
	// LocalDynamoDBUri is the default local dynamodb URI.
	LocalDynamoDBUri = "http://127.0.0.1:8000"
)

// TestDynamoDBRunner manages starting/stopping a local dynamodb test server.
type TestDynamoDBRunner struct {
	cmd *exec.Cmd
}

// NewTestDynamoDBRunner instatiates a new runner.
func NewTestDynamoDBRunner() (*TestDynamoDBRunner, error) {
	tdr := new(TestDynamoDBRunner)
	if err := tdr.downloadIfNecessary(); err != nil {
		return nil, err
	}
	return tdr, nil
}

func (tdr *TestDynamoDBRunner) tmpDir() string {
	return filepath.Join(os.TempDir(), LocalDynamoDBTmpDir)
}

func (tdr *TestDynamoDBRunner) pidFilePath() string {
	return filepath.Join(tdr.tmpDir(), LocalDynamoDBPidFile)
}

func (tdr *TestDynamoDBRunner) jarFilePath() string {
	return filepath.Join(tdr.tmpDir(), LocalDynamoDBJarFile)
}

func (tdr *TestDynamoDBRunner) writePid(pid int) error {
	out, err := os.Create(tdr.pidFilePath())
	if err != nil {
		return err
	}
	_, err = out.WriteString(strconv.Itoa(pid))
	defer out.Close()
	return err
}

func (tdr *TestDynamoDBRunner) getPid() (int, error) {
	pidStr, err := ioutil.ReadFile(tdr.pidFilePath())
	if err != nil {
		return 0, err
	}
	return strconv.Atoi(string(pidStr))
}

func (tdr *TestDynamoDBRunner) downloadIfNecessary() error {
	// does the jar file exist?
	jarPath := tdr.jarFilePath()
	if _, err := ioutil.Stat(jarPath); err == nil {
		return nil
	}

	// create the tmp directory if it doesn't exist
	if _, err := ioutil.Stat(tdr.tmpDir()); ioutil.IsNotExist(err) {
		if err := ioutil.Mkdir(tdr.tmpDir(), os.ModeDir|os.ModePerm); err != nil {
			return err
		}
	}

	// download
	response, err := http.Get(LocalDynamoDBDownloadURI)
	if err != nil {
		return err
	}
	defer libkb.DiscardAndCloseBody(response)

	// read body into buffer and compute the hash
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(response.Body); err != nil {
		return err
	}
	hash := sha256.New()
	hash.Write(buf.Bytes())
	sha256Hash := hex.EncodeToString(hash.Sum(nil))

	// verify the hash
	if sha256Hash != LocalDynamoDBSha256Hash {
		return fmt.Errorf("expected hash %s, got: %s",
			LocalDynamoDBSha256Hash, sha256Hash)
	}

	// create the download file
	path := filepath.Join(tdr.tmpDir(), "dynamodb_local.tar.gz")
	out, err := os.Create(path)
	if err != nil {
		return err
	}
	defer out.Close()

	// write it out
	_, err = io.Copy(out, bytes.NewReader(buf.Bytes()))
	if err != nil {
		return err
	}

	// untar
	untar := exec.Command("tar", "-C", tdr.tmpDir(), "-xzvf", path)
	return untar.Run()
}

func findAndKill(t logger.TestLogBackend, pid int, created bool) {
	if p, err := os.FindProcess(pid); err == nil {
		if err := p.Signal(syscall.SIGTERM); err != nil {
			if err.Error() != "os: process already finished" {
				t.Fatal(err)
			}
		} else if created {
			p.Wait()
		}
	}
}

// Shutdown terminates any running instance.
func (tdr *TestDynamoDBRunner) Shutdown(t logger.TestLogBackend) {
	findAndKill(t, tdr.cmd.Process.Pid, true)
}

// Run starts the local DynamoDB server.
func (tdr *TestDynamoDBRunner) Run(t logger.TestLogBackend) {
	// kill any old process
	if pid, err := tdr.getPid(); err == nil {
		findAndKill(t, pid, false)
	}

	// setup the command
	tmpDir := tdr.tmpDir()
	tdr.cmd = exec.Command("java",
		"-Djava.library.path="+filepath.Join(tmpDir, "DynamoDBLocal_lib"),
		"-jar", tdr.jarFilePath(), "-inMemory")

	// exec in a goroutine
	go func() {
		// start dynamo
		if err := tdr.cmd.Start(); err != nil {
			t.Fatal(err)
		}
		if err := tdr.writePid(tdr.cmd.Process.Pid); err != nil {
			t.Fatal(err)
		}
		// wait on exit
		tdr.cmd.Wait()
	}()

	// wait for it to come up
	ok := false
	for i := 0; i < 200; i++ {
		region := aws.Region{
			DynamoDBEndpoint:        LocalDynamoDBUri,
			DynamoDBStreamsEndpoint: LocalDynamoDBUri,
		}
		auth := aws.NewAuth("DUMMY_KEY", "DUMMY_SECRET", "", time.Time{})
		server := &dynamodb.Server{Auth: auth, Region: region}
		if _, err := server.ListTables(); err != nil {
			time.Sleep(time.Millisecond * 250)
		} else {
			ok = true
			break
		}
	}
	if !ok {
		t.Fatal("dynamodb did not start up cleanly")
	}
}
