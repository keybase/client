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
	"strconv"
	"strings"
	"testing"
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

func getDockerInfo(f string) (map[string]map[string]string, error) {
	cmd := exec.Command("docker-compose", "ps", "-q", f)
	var buf bytes.Buffer
	cmd.Stdout = &buf
	err := cmd.Run()
	if err != nil {
		return nil, err
	}
	containers := strings.Split(strings.TrimSpace(buf.String()), "\n")

	containerMap := make(map[string]map[string]string)
	for _, c := range containers {
		var buf bytes.Buffer
		err = dockerExec(&buf, nil, c, "sh", "-c", "keybase status 2>/dev/null | grep Username: | awk '{print $2}'")
		if err != nil {
			continue
		}
		username := strings.TrimSpace(buf.String())
		buf.Reset()
		err = dockerExec(&buf, nil, c, "sh", "-c", "keybase status 2>/dev/null | grep -A3 Device: | grep name: | awk '{print $2}'")
		if err != nil {
			continue
		}
		deviceId := strings.TrimSpace(buf.String())

		if containerMap[username] == nil {
			containerMap[username] = make(map[string]string)
		}
		containerMap[username][deviceId] = c
	}
	if len(containerMap) == 0 {
		return nil, fmt.Errorf("Unable to obtain docker info")
	}
	return containerMap, nil
}

func startDockers(numUsers int) error {
	cmd := createStdoutCommand(fmt.Sprintf("%s/src/github.com/keybase/kbfs/test/run_dockers.sh", os.Getenv("GOPATH")), "-u", strconv.Itoa(numUsers))
	return cmd.Run()
}

func stopDockers() error {
	cmd := createStdoutCommand("docker-compose", "down")
	return cmd.Run()
}

func resetService(n int) (map[string]map[string]string, error) {
	err := stopDockers()
	if err != nil {
		return nil, fmt.Errorf("Unable to scale down the service: %v", err)
	}
	err = startDockers(n)
	if err != nil {
		return nil, fmt.Errorf("Unable to start the service: %v", err)
	}
	return getDockerInfo("keybase")
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

func readFromFile(container string, tlf string, filename string) (string, error) {
	var buf bytes.Buffer
	err := dockerExec(&buf, nil, container, "cat", fmt.Sprintf("%s/%s", tlf, filename))

	if err != nil {
		return "", fmt.Errorf("Unable to read from file %s/%s on container %s", tlf, filename, container)
	}
	result := strings.TrimSpace(buf.String())
	fmt.Println(result)
	return result, nil
}

func TestSharedFileWrite(t *testing.T) {
	containers, err := resetService(2)
	if err != nil {
		stopDockers()
		t.Fatalf("Failed to reset service: %v", err)
	}
	tlf := getTLF([]string{"test0", "test1"}, []string{})
	err = writeToFile(
		containers["test0"]["dev0"],
		tlf,
		"hello.txt",
		"world",
	)
	if err != nil {
		stopDockers()
		t.Fatalf("Failed to write to file: %v", err)
	}
	err = listFolder(
		containers["test1"]["dev0"],
		tlf,
	)
	if err != nil {
		stopDockers()
		t.Fatalf("Failed to list folder %s. Error: %v", tlf, err)
	}
	result, err := readFromFile(
		containers["test1"]["dev0"],
		tlf,
		"hello.txt",
	)
	if err != nil {
		stopDockers()
		t.Fatalf("Failed to read from file: %v", err)
	}
	if result != "world" {
		stopDockers()
		t.Fatalf("Incorrect result from write. Expected: \"world\", actual: %s", result)
	}

	err = stopDockers()
	if err != nil {
		t.Fatalf("Failed to stop dockers: %v", err)
	}
}
