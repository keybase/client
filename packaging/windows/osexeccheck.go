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
// discussion. Below is a patch showing the required change:
//
// diff --git a/src/os/exec/lp_windows.go b/src/os/exec/lp_windows.go
// index e7a2cdf142..f4f0bec172 100644
// --- a/src/os/exec/lp_windows.go
// +++ b/src/os/exec/lp_windows.go
// @@ -81,9 +81,6 @@ func LookPath(file string) (string, error) {
//                         return "", &Error{file, err}
//                 }
//         }
// -       if f, err := findExecutable(filepath.Join(".", file), exts); err == nil {
// -               return f, nil
// -       }
//         path := os.Getenv("path")
//         for _, dir := range filepath.SplitList(path) {
//                 if f, err := findExecutable(filepath.Join(dir, file), exts); err == nil {

package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const FailureOutput = "check failed"

func createBatFile() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get working directory: %w", err)
	}
	execPath := filepath.Join(wd, "go.bat")
	if err := os.WriteFile(execPath, []byte("@echo "+FailureOutput), 0777); err != nil {
		return "", fmt.Errorf("failed to write bat file: %w", err)
	}
	return execPath, nil
}

func execGoCommand() error {
	cmd := exec.Command("go", "version")
	outbytes, err := cmd.CombinedOutput()
	if err != nil {
		// Go 1.19 now doesn't allow running executabls that match the relative path,
		// and so this errors out. That is good enough for us.
		fmt.Printf("got an error running go command (should be ok): %s\n", err)
		return nil
	}
	out := strings.TrimSpace(string(outbytes[:]))
	log.Printf("output: %s", out)
	if out == FailureOutput {
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
