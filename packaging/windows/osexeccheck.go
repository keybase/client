// On Windows, the default algorithm for searching for executable files involves looking in the current
// directory first. Go reproduces this behavior in order to stay true to how the underlying OS works.
// However, looking for executables in this order is a security problem, since attackers can induce
// an admin to invoke a rogue script by naming it with a common executable name, like git or go. If the attacker
// manages to get an admin to run `git` in a directory in which they have placed their own git.bat file
// (which could do anything), then they have exploited the system.
//
// We want to ensure that when building our own Windows distribution of Keybase, that the behavior of looking
// in the current diectory for an executable first is disabled. This test ensures that the os/exec package
// has been suitably modified to get the correct more secure behavior.
//
// In order to fix an error from this checker, you must patch the os/exec package on the machine where this
// check runs to remove the current directory search path. See https://go.dev/blog/path-security for more
// discussion.

package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

const FailureOutput = "check failed"

func createBatFile() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get working directory: %w", err)
	}
	execPath := filepath.Join(wd, "go.bat")
	if err := os.WriteFile(execPath, []byte(FailureOutput), 0777); err != nil {
		return "", fmt.Errorf("failed to write bat file: %w", err)
	}
	return execPath, nil
}

func execGoCommand() error {
	cmd := exec.Command("go", "version")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to run go command: %w", err)
	}
	log.Printf("output: %s", out)
	if string(out[:]) == FailureOutput {
		return fmt.Errorf("Ran go.bat instead of go! In order to fix see the top comment in this source file")
	}
	return nil
}

func run() error {
	path, err := createBatFile()
	if err != nil {
		log.Printf("error creating bat file: %s", err)
		return err
	}
	defer os.Remove(path)
	if err := execGoCommand(); err != nil {
		log.Printf("failed to execute go command: %s", err)
		return err
	}
	return nil
}

func main() {
	if err := run(); err != nil {
		os.Exit(3)
	}
}
