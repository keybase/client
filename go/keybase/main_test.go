
package main 

import (
	"fmt"
	"os"
	"os/exec"
	"testing"
	"path"
)

func compileBinary() error {
	if prog,err := exec.LookPath("go"); err != nil {
		return err
	} else if out,err := exec.Command(prog, "install").CombinedOutput(); err != nil {
		return err
	} else {
		fmt.Printf("compiled `keybase` binary: %v\n", out)
	}
	return nil
}

func keybaseBinaryPath() string {
	gopath := os.Getenv("GOPATH")
	binpath := path.Join(gopath, "bin", "keybase")
	return binpath
}

func TestMain(m *testing.M) {
	if err := compileBinary(); err != nil {
		fmt.Printf("Error: %s\n", err.Error())
		os.Exit(2)
	}
	os.Exit(m.Run())
}