// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package launchd

import (
	"encoding/xml"
	"fmt"
	"math/rand"
	"os"
	"testing"
	"time"

	"github.com/kardianos/osext"
)

func validExecutableForTest() (string, error) {
	return osext.Executable()
}

func TestPlist(t *testing.T) {
	binPath, err := validExecutableForTest()
	if err != nil {
		t.Fatal(err)
	}
	envVars := []EnvVar{
		NewEnvVar("TESTVAR1", "1"),
		NewEnvVar("TESTVAR2", "2"),
	}
	plist := NewPlist("keybase.testing", binPath, []string{"--flag=test", "testArg"}, envVars, "keybase.testing.log", "This is a comment")

	data := plist.plistXML()
	t.Logf("Plist: %s\n", data)

	var i interface{}
	// This tests valid XML but not actual values
	err = xml.Unmarshal([]byte(data), &i)
	if err != nil {
		t.Errorf("Bad plist: %s", err)
	}
}

func TestCheckPlist(t *testing.T) {
	label := fmt.Sprintf("keybase.testing.checkplist.%s", randStringBytes(32))
	t.Logf("Label: %s", label)
	service := NewService(label)
	defer os.Remove(service.plistDestination())

	binPath, err := validExecutableForTest()
	if err != nil {
		t.Fatal(err)
	}
	envVars := []EnvVar{
		NewEnvVar("TESTVAR1", "1"),
		NewEnvVar("TESTVAR2", "2"),
	}
	plist := NewPlist(label, binPath, []string{}, envVars, "keybase.testing.log", "")
	plistIsValid, err := service.CheckPlist(plist)
	if err != nil {
		t.Fatal(err)
	}
	if plistIsValid {
		t.Fatalf("We shouldn't have a plist")
	}

	err = service.savePlist(plist)
	if err != nil {
		t.Fatal(err)
	}

	// Check valid plist after save
	plistIsValidAfter, err := service.CheckPlist(plist)
	if err != nil {
		t.Fatal(err)
	}
	if !plistIsValidAfter {
		t.Fatalf("Plist was invalid after install")
	}

	// Check a new plist
	plistNew := NewPlist(label, binPath, []string{"differentArgs"}, envVars, "keybase.testing.log", "")
	plistNewIsValid, err := service.CheckPlist(plistNew)
	if err != nil {
		t.Fatal(err)
	}
	if plistNewIsValid {
		t.Fatal("New plist should be invalid")
	}

	err = service.savePlist(plistNew)
	if err != nil {
		t.Fatal(err)
	}

	plistNewIsValidAfterInstall, err := service.CheckPlist(plistNew)
	if err != nil {
		t.Fatal(err)
	}
	if !plistNewIsValidAfterInstall {
		t.Fatalf("New plist should be valid after install")
	}
}

func randStringBytes(n int) string {
	const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
	b := make([]byte, n)
	for i := range b {
		b[i] = letterBytes[rand.Intn(len(letterBytes))]
	}
	return string(b)
}

func TestWaitForStatusOK(t *testing.T) {
	fn := func() (*ServiceStatus, error) {
		return &ServiceStatus{label: "ok", pid: "1"}, nil
	}
	status, err := waitForStatus(time.Second, time.Millisecond, fn)
	if err != nil {
		t.Fatal(err)
	}
	if status == nil || status.label != "ok" {
		t.Fatalf("Invalid status")
	}
}

func TestWaitForStatusDelayed(t *testing.T) {
	i := 0
	fn := func() (*ServiceStatus, error) {
		i++
		if i == 5 {
			return &ServiceStatus{label: "ok_delayed", pid: "1"}, nil
		}
		return nil, nil
	}
	status, err := waitForStatus(time.Second, time.Millisecond, fn)
	if err != nil {
		t.Fatal(err)
	}
	if status == nil {
		t.Fatalf("Wait timed out")
	}
	if status.label != "ok_delayed" {
		t.Fatalf("Invalid status")
	}
}

func TestWaitForStatusErrored(t *testing.T) {
	fn := func() (*ServiceStatus, error) {
		return nil, fmt.Errorf("status error")
	}
	_, err := waitForStatus(time.Second, time.Millisecond, fn)
	if err == nil {
		t.Fatal("Expected error")
	}
	if err.Error() != "status error" {
		t.Fatal("Expected error returned from fn above")
	}
}

func TestWaitForStatusTimeout(t *testing.T) {
	fn := func() (*ServiceStatus, error) {
		return nil, nil
	}
	status, err := waitForStatus(5*time.Millisecond, time.Millisecond, fn)
	if err != nil {
		t.Fatal(err)
	}
	if status != nil {
		t.Fatalf("Status should be nil (timed out): %#v", status)
	}
}

func TestWaitForExitOK(t *testing.T) {
	fn := func() (*ServiceStatus, error) {
		return nil, nil
	}
	err := waitForExit(time.Second, time.Millisecond, fn)
	if err != nil {
		t.Fatal(err)
	}
}

func TestWaitForExitDelayed(t *testing.T) {
	i := 0
	fn := func() (*ServiceStatus, error) {
		i++
		if i < 5 {
			return &ServiceStatus{label: "ok", pid: "1"}, nil
		}
		return nil, nil
	}
	err := waitForExit(time.Second, time.Millisecond, fn)
	if err != nil {
		t.Fatal(err)
	}
}

func TestWaitForExitErrored(t *testing.T) {
	fn := func() (*ServiceStatus, error) {
		return nil, fmt.Errorf("status error")
	}
	err := waitForExit(time.Second, time.Millisecond, fn)
	if err == nil {
		t.Fatal("Expected error")
	}
}

func TestWaitForExitTimeout(t *testing.T) {
	fn := func() (*ServiceStatus, error) {
		return &ServiceStatus{label: "never_exit", pid: "1"}, nil
	}
	err := waitForExit(5*time.Millisecond, time.Millisecond, fn)
	if err == nil {
		t.Fatal("Should have timed out")
	}
	if err.Error() != "Waiting for service exit timed out" {
		t.Fatal("Should have timed out error")
	}
}
