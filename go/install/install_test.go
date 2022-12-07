// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin
// +build darwin

package install

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/stretchr/testify/require"
)

var testLog = logger.New("test")

func TestCommandLine(t *testing.T) {
	testDir, err := os.MkdirTemp("", "kbbin")
	defer os.RemoveAll(testDir)
	if err != nil {
		t.Fatalf("%s", err)
	}

	binPath, err := filepath.Abs(os.Args[0])
	if err != nil {
		t.Fatalf("%s", err)
	}
	linkPath := filepath.Join(testDir, "kbtest")

	// Install
	err = installCommandLineForBinPath(binPath, linkPath, true, testLog)
	if err != nil {
		t.Fatalf("%s", err)
	}
	_, err = os.Stat(linkPath)
	if err != nil {
		t.Fatalf("%s", err)
	}

	// Install again
	err = installCommandLineForBinPath(binPath, linkPath, true, testLog)
	if err != nil {
		t.Fatalf("%s", err)
	}
	_, err = os.Stat(linkPath)
	if err != nil {
		t.Fatalf("%s", err)
	}
}

func TestLastModifiedMatchingFile(t *testing.T) {
	var err error
	tc := libkb.SetupTest(t, "TestLastModifiedMatchingFile", 1)
	defer tc.Cleanup()
	tmpdir, err := os.MkdirTemp("", "TestLastModifiedMatchingFile")
	defer os.RemoveAll(tmpdir)
	require.NoError(t, err)
	nameMatch := "blerg"
	contentMatch := "lemon"
	matchingContent := fmt.Sprintf("la la la\nblah blah\nblah%s a match!\n", contentMatch)
	unmatchingContent := "la la la\nblah blah\nblah no matches\n"
	filePattern := filepath.Join(tmpdir, fmt.Sprintf("*%s*", nameMatch))

	// no matches with no files
	match, err := LastModifiedMatchingFile(filePattern, contentMatch)
	require.NoError(t, err)
	require.Nil(t, match)

	// no matches with two files that each only half match
	err = os.WriteFile(filepath.Join(tmpdir, fmt.Sprintf("first%sfile.txt", nameMatch)), []byte(unmatchingContent), 0644)
	require.NoError(t, err)
	err = os.WriteFile(filepath.Join(tmpdir, "secondfile.txt"), []byte(matchingContent), 0644)
	require.NoError(t, err)

	match, err = LastModifiedMatchingFile(filePattern, contentMatch)
	require.NoError(t, err)
	require.Nil(t, match)

	// with an actual match
	fullPath := filepath.Join(tmpdir, fmt.Sprintf("third%sfile.txt", nameMatch))
	err = os.WriteFile(fullPath, []byte(matchingContent), 0644)
	require.NoError(t, err)
	match, err = LastModifiedMatchingFile(filePattern, contentMatch)
	require.NoError(t, err)
	require.NotNil(t, match)
	require.Equal(t, fullPath, *match)

	// with another match
	fullPath = filepath.Join(tmpdir, fmt.Sprintf("fourth%sfile.txt", nameMatch))
	err = os.WriteFile(fullPath, []byte(matchingContent), 0644)
	require.NoError(t, err)
	match, err = LastModifiedMatchingFile(filePattern, contentMatch)
	require.NoError(t, err)
	require.NotNil(t, match)
	require.Equal(t, fullPath, *match)

	// result doesn't change after additional files are added
	err = os.WriteFile(filepath.Join(tmpdir, fmt.Sprintf("fifth%sfile.txt", nameMatch)), []byte(unmatchingContent), 0644)
	require.NoError(t, err)
	err = os.WriteFile(filepath.Join(tmpdir, "sixthfile.txt"), []byte(matchingContent), 0644)
	require.NoError(t, err)
	match, err = LastModifiedMatchingFile(filePattern, contentMatch)
	require.NoError(t, err)
	require.NotNil(t, match)
	require.Equal(t, fullPath, *match)
}
