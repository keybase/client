package libkbfs

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"testing"
	"time"
)

const (
	// LocalDynamoDBDownloadURI source: http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Tools.DynamoDBLocal.html
	// We don't use latest because Amazon doesn't offer https downloads of this. So we peg to a revision and verify the hash.
	LocalDynamoDBDownloadURI = "http://dynamodb-local.s3-website-us-west-2.amazonaws.com/dynamodb_local_2015-07-16_1.0.tar.gz"
	// LocalDynamoDBSha256Hash is the sha256 hash of the above tar ball.
	LocalDynamoDBSha256Hash = "5868fd4b9f624001cda88059af7a54f412a4794dea0d3497e7c57470bfb272fa"
	// LocalDynamoDBTmpDir is relative to the system's own TempDir.
	LocalDynamoDBTmpDir = "dynamodb_local/"
	// LocalDynamoDBPidFile contains the process ID.
	LocalDynamoDBPidFile = "dynamodb.pid"
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
	return os.TempDir() + LocalDynamoDBTmpDir
}

func (tdr *TestDynamoDBRunner) writePid(pid int) error {
	pidFile := tdr.tmpDir() + LocalDynamoDBPidFile
	out, err := os.Create(pidFile)
	if err != nil {
		return err
	}
	_, err = out.WriteString(strconv.Itoa(pid))
	defer out.Close()
	return err
}

func (tdr *TestDynamoDBRunner) getPid() (int, error) {
	pidFile := tdr.tmpDir() + LocalDynamoDBPidFile
	pidStr, err := ioutil.ReadFile(pidFile)
	if err != nil {
		return 0, err
	}
	return strconv.Atoi(string(pidStr))
}

func (tdr *TestDynamoDBRunner) downloadIfNecessary() error {
	dir := tdr.tmpDir()

	// does the jar file exist?
	jarPath := dir + "DynamoDBLocal.jar"
	if _, err := os.Stat(jarPath); err == nil {
		return nil
	}

	// create the directory if it doesn't exist
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.Mkdir(dir, os.ModeDir|os.ModePerm); err != nil {
			return err
		}
	}

	// download
	response, err := http.Get(LocalDynamoDBDownloadURI)
	if err != nil {
		return err
	}
	defer response.Body.Close()

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
		return fmt.Errorf("Expected hash %s, got: %s\n",
			LocalDynamoDBSha256Hash, sha256Hash)
	}

	// create the download file
	path := dir + "dynamodb_local.tar.gz"
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
	untar := exec.Command("tar", "-C", dir, "-xzvf", path)
	return untar.Run()
}

// Run starts the local DynamoDB server.
func (tdr *TestDynamoDBRunner) Run(t *testing.T) {
	// kill any old process
	if pid, err := tdr.getPid(); err == nil {
		if p, err := os.FindProcess(pid); err == nil {
			if err := p.Kill(); err != nil {
				// you might think this would satisfy !os.IsNotExist
				// but alas, no, you'd be really wrong about this.
				if err.Error() != "os: process already finished" {
					t.Fatal(err)
				}
			}
		}
	}

	// setup the command
	tmpDir := tdr.tmpDir()
	tdr.cmd = exec.Command("java",
		"-Djava.library.path="+tmpDir+"DynamoDBLocal_lib",
		"-jar", tmpDir+"DynamoDBLocal.jar", "-inMemory")

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

	// XXX TODO: look for a listener
	time.Sleep(2 * time.Second)
}
