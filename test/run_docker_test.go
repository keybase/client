// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build docker

package test

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"testing"

	//"github.com/samalba/dockerclient"
)

func createCommand(out io.Writer, err io.Writer, c string, args ...string) *exec.Cmd {
	fmt.Println(strings.Join(append([]string{"$", c}, args...), " "))
	cmd := exec.Command(c, args...)
	cmd.Stdout = out
	cmd.Stderr = err
	return cmd
}

func createStdoutCommand(c string, args ...string) *exec.Cmd {
	cmd := createCommand(os.Stdout, os.Stderr, c, args...)
	return cmd
}

func dockerExec(out io.Writer, err io.Writer, container string, command ...string) error {
	args := append([]string{
		"exec",
		container,
	}, command...)
	cmd := createCommand(out, err, "docker", args...)
	return cmd.Run()
}

func getDockerIds(f string) ([]string, error) {
	cmd := exec.Command("docker-compose", "ps", "-q", f)
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	err := cmd.Run()
	if err != nil {
		return nil, err
	}
	return strings.Split(strings.TrimSpace(buf.String()), "\n"), nil
}

func startDockers() error {
	cmd := createStdoutCommand(fmt.Sprintf("%s/src/github.com/keybase/kbfs/test/run_dockers.sh", os.Getenv("GOPATH")))
	return cmd.Run()
}

func stopDockers() error {
	cmd := createStdoutCommand("docker-compose", "down")
	return cmd.Run()
}

func resetService(n int) (map[string]string, error) {
	err := stopDockers()
	if err != nil {
		return nil, fmt.Errorf("Unable to scale down the service: %v", err)
	}
	err = startDockers()
	if err != nil {
		return nil, fmt.Errorf("Unable to start the service: %v", err)
	}
	err = createStdoutCommand("docker-compose", "scale", fmt.Sprintf("keybase=%d", n)).Run()
	if err != nil {
		return nil, fmt.Errorf("Unable to scale up the service: %v", err)
	}
	containers, err := getDockerIds("keybase")
	if err != nil {
		return nil, fmt.Errorf("Unable to obtain docker IDs: %v", err)
	}
	return signupContainers(containers)
}

func signupContainer(container string, username string) error {
	email := fmt.Sprintf("%s@keyba.se", username)

	cmd := createCommand(nil, nil, "docker", "exec", container,
		"keybase", "signup", "-c", "202020202020202020202020",
		"--email", email, "--username", username,
		"-p", "strong passphrase", "-d", "dev1", "-b", "--devel")

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("Unable to signup user %s on container %s. Error: %v", username, container, err)
	}
	return nil
}

func signupContainers(containers []string) (map[string]string, error) {
	containersByUsername := make(map[string]string)

	for i, container := range containers {

		username := fmt.Sprintf("test%d", i)
		err := signupContainer(container, username)
		if err != nil {
			return nil, err
		}

		containersByUsername[username] = container
	}
	return containersByUsername, nil
}

func getTLF(writers []string, readers []string) string {
	content := []string{strings.Join(writers, ",")}
	if len(readers) > 0 {
		content = append(content, strings.Join(readers, "#"))
	}
	return fmt.Sprintf("/keybase/private/%s", strings.Join(content, "#"))
}

func listFolder(container string, tlf string) error {
	err := dockerExec(os.Stdout, os.Stderr, container, "ls", tlf)

	if err != nil {
		return fmt.Errorf("Unable to list folder %s on container %s. Error: %v", tlf, container)
	}
	return nil
}

func writeToFile(container string, tlf string, filename string, text string) error {
	err := dockerExec(os.Stdout, os.Stderr, container, "sh", "-c", fmt.Sprintf("echo \"%s\" >> %s", text, fmt.Sprintf("%s/%s", tlf, filename)))

	if err != nil {
		return fmt.Errorf("Unable to write to file %s/%s on container %s", tlf, filename, container)
	}
	return nil
}

func readFromFile(container string, tlf string, filename string) error {
	err := dockerExec(os.Stdout, os.Stderr, container, "cat", fmt.Sprintf("%s/%s", tlf, filename))

	if err != nil {
		return fmt.Errorf("Unable to read from file %s/%s on container %s", tlf, filename, container)
	}
	return nil
}

func TestSharedFileWrite(t *testing.T) {
	containers, err := resetService(2)
	if err != nil {
		t.Fatalf("Failed to reset service: %v", err)
	}
	tlf := getTLF([]string{"test0", "test1"}, []string{})
	err = writeToFile(
		containers["test0"],
		tlf,
		"hello.txt",
		"world",
	)
	if err != nil {
		stopDockers()
		t.Fatalf("Failed to write to file: %v", err)
	}
	err = listFolder(
		containers["test1"],
		tlf,
	)
	if err != nil {
		stopDockers()
		t.Fatalf("Failed to list folder %s. Error: %v", tlf, err)
	}
	err = readFromFile(
		containers["test1"],
		tlf,
		"hello.txt",
	)
	if err != nil {
		stopDockers()
		t.Fatalf("Failed to write to file: %v", err)
	}

	err = stopDockers()
	if err != nil {
		t.Fatalf("Failed to stop dockers: %v", err)
	}
}
