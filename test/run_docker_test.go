// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build docker

package test

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"testing"

	//"github.com/samalba/dockerclient"
)

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
	cmd := exec.Command(fmt.Sprintf("%s/src/github.com/keybase/kbfs/test/run_dockers.sh", os.Getenv("GOPATH")))
	return cmd.Run()
}

func stopDockers() error {
	cmd := exec.Command("docker-compose", "down")
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
	err = exec.Command("docker-compose", "scale", fmt.Sprintf("keybase=%d", n)).Run()
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

	cmd := exec.Command("docker", "exec", container,
		"keybase", "signup", "-c", "202020202020202020202020",
		"--email", email, "--username", username,
		"-p", "\"strong passphrase\"", "-d", "dev1", "-b", "--devel")

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("Unable to signup container %s for user %s. Error: %v", container, username)
	}
	return nil
}

func signupContainers(containers []string) (map[string]string, error) {
	usernamesByContainer := make(map[string]string)

	for i, container := range containers {

		username := fmt.Sprintf("test%d", i)
		err := signupContainer(container, username)
		if err != nil {
			return nil, err
		}

		usernamesByContainer[container] = username
	}
	return usernamesByContainer, nil
}

func TestBasicFileWrite(t *testing.T) {
	_, err := resetService(1)
	if err != nil {
		t.Fatalf("Failed to reset service: %v", err)
	}

	//err := stopDockers()
	//if err != nil {
	//	t.Fatalf("Failed to stop dockers: %v", err)
	//}

}
