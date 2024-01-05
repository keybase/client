// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"fmt"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testZipPath, testSymZipPath, testCorruptedZipPath, testInvalidZipPath string

func init() {
	_, filename, _, _ := runtime.Caller(0)
	// testZipPath is a valid zip file
	testZipPath = filepath.Join(filepath.Dir(filename), "../test/test.zip")
	// testSymZipPath is a valid zip file with a symbolic link
	testSymZipPath = filepath.Join(filepath.Dir(filename), "../test/test-with-sym.zip")
	// testCorruptedZipPath is a corrupted zip file (flipped a bit)
	testCorruptedZipPath = filepath.Join(filepath.Dir(filename), "../test/test-corrupted2.zip")
	// testInvalidZipPath is not a valid zip file
	testInvalidZipPath = filepath.Join(filepath.Dir(filename), "../test/test-invalid.zip")
}

func assertFileExists(t *testing.T, path string) {
	t.Logf("Checking %s", path)
	fileExists, err := FileExists(path)
	assert.NoError(t, err)
	assert.True(t, fileExists)
}

func testUnzipOverValid(t *testing.T, path string) string {
	destinationPath := TempPath("", "TestUnzipOver.")

	noCheck := func(sourcePath, destinationPath string) error { return nil }

	err := UnzipOver(path, "test", destinationPath, noCheck, "", testLog)
	require.NoError(t, err)

	dirExists, err := FileExists(destinationPath)
	assert.NoError(t, err)
	assert.True(t, dirExists)

	assertFileExists(t, filepath.Join(destinationPath, "testfile"))
	assertFileExists(t, filepath.Join(destinationPath, "testfolder"))
	assertFileExists(t, filepath.Join(destinationPath, "testfolder", "testsubfolder"))
	assertFileExists(t, filepath.Join(destinationPath, "testfolder", "testsubfolder", "testfile2"))

	// Unzip again over existing path
	err = UnzipOver(path, "test", destinationPath, noCheck, "", testLog)
	require.NoError(t, err)

	dirExists2, err := FileExists(destinationPath)
	require.NoError(t, err)
	require.True(t, dirExists2)

	fileExists2, err := FileExists(filepath.Join(destinationPath, "testfile"))
	require.NoError(t, err)
	require.True(t, fileExists2)

	// Unzip again over existing path, fail check
	failCheck := func(sourcePath, destinationPath string) error { return fmt.Errorf("Failed check") }
	err = UnzipOver(testZipPath, "test", destinationPath, failCheck, "", testLog)
	assert.Error(t, err)

	return destinationPath
}

func TestUnzipOverValid(t *testing.T) {
	destinationPath := testUnzipOverValid(t, testZipPath)
	defer RemoveFileAtPath(destinationPath)
}

func TestUnzipOverSymlink(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Symlink in zip unsupported on Windows")
	}
	destinationPath := testUnzipOverValid(t, testSymZipPath)
	defer RemoveFileAtPath(destinationPath)
	assertFileExists(t, filepath.Join(destinationPath, "testfolder", "testlink"))
}

func TestUnzipOverInvalidPath(t *testing.T) {
	noCheck := func(sourcePath, destinationPath string) error { return nil }
	err := UnzipOver(testZipPath, "test", "", noCheck, "", testLog)
	assert.Error(t, err)

	destinationPath := TempPath("", "TestUnzipOverInvalidPath.")
	defer RemoveFileAtPath(destinationPath)
	err = UnzipOver("/badfile.zip", "test", destinationPath, noCheck, "", testLog)
	assert.Error(t, err)

	err = UnzipOver("", "test", destinationPath, noCheck, "", testLog)
	assert.Error(t, err)

	err = unzipOver("", "", testLog)
	assert.Error(t, err)
}

func TestUnzipOverInvalidZip(t *testing.T) {
	noCheck := func(sourcePath, destinationPath string) error { return nil }
	destinationPath := TempPath("", "TestUnzipOverInvalidZip.")
	defer RemoveFileAtPath(destinationPath)
	err := UnzipOver(testInvalidZipPath, "test", destinationPath, noCheck, "", testLog)
	t.Logf("Error: %s", err)
	assert.Error(t, err)
}

func TestUnzipOverInvalidContents(t *testing.T) {
	noCheck := func(sourcePath, destinationPath string) error { return nil }
	destinationPath := TempPath("", "TestUnzipOverInvalidContents.")
	defer RemoveFileAtPath(destinationPath)
	err := UnzipOver(testInvalidZipPath, "invalid", destinationPath, noCheck, "", testLog)
	t.Logf("Error: %s", err)
	assert.Error(t, err)
}

func TestUnzipOverCorrupted(t *testing.T) {
	noCheck := func(sourcePath, destinationPath string) error { return nil }
	destinationPath := TempPath("", "TestUnzipOverCorrupted.")
	defer RemoveFileAtPath(destinationPath)
	err := UnzipOver(testCorruptedZipPath, "test", destinationPath, noCheck, "", testLog)
	t.Logf("Error: %s", err)
	assert.Error(t, err)
}

func tempDir(t *testing.T) string {
	tmpDir := TempPath("", "TestUnzipOver")
	err := MakeDirs(tmpDir, 0700, testLog)
	require.NoError(t, err)
	return tmpDir
}

func TestUnzipOverMoveExisting(t *testing.T) {
	noCheck := func(sourcePath, destinationPath string) error { return nil }
	destinationPath := TempPath("", "TestUnzipOverMoveExisting.")
	defer RemoveFileAtPath(destinationPath)
	tmpDir := tempDir(t)
	defer RemoveFileAtPath(tmpDir)
	err := UnzipOver(testZipPath, "test", destinationPath, noCheck, tmpDir, testLog)
	assert.NoError(t, err)
	err = UnzipOver(testZipPath, "test", destinationPath, noCheck, tmpDir, testLog)
	assert.NoError(t, err)

	assertFileExists(t, filepath.Join(tmpDir, filepath.Base(destinationPath)))
}
