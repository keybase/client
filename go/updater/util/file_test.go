// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewFile(t *testing.T) {
	filename := filepath.Join(os.TempDir(), "TestNewFile")
	defer RemoveFileAtPath(filename)

	f := NewFile(filename, []byte("somedata"), 0600)
	err := f.Save(testLog)
	assert.NoError(t, err)

	fileInfo, err := os.Stat(filename)
	assert.NoError(t, err)
	assert.False(t, fileInfo.IsDir())

	if runtime.GOOS != "windows" {
		assert.EqualValues(t, 0600, fileInfo.Mode().Perm())
	}
}

func TestMakeParentDirs(t *testing.T) {
	dir := filepath.Join(os.TempDir(), "TestMakeParentDirs", "TestMakeParentDirs2", "TestMakeParentDirs3")
	defer RemoveFileAtPath(dir)

	file := filepath.Join(dir, "testfile")
	defer RemoveFileAtPath(file)

	err := MakeParentDirs(file, 0700, testLog)
	assert.NoError(t, err)

	exists, err := FileExists(dir)
	assert.NoError(t, err)
	assert.True(t, exists, "File doesn't exist")

	fileInfo, err := os.Stat(dir)
	assert.NoError(t, err)
	assert.True(t, fileInfo.IsDir())
	if runtime.GOOS != "windows" {
		assert.EqualValues(t, 0700, fileInfo.Mode().Perm())
	}

	// Test making dir that already exists
	err = MakeParentDirs(file, 0700, testLog)
	assert.NoError(t, err)
}

func TestMakeParentDirsInvalid(t *testing.T) {
	err := MakeParentDirs("\\\\invalid", 0700, testLog)
	if runtime.GOOS != "windows" {
		assert.EqualError(t, err, "No base directory")
	} else {
		assert.Error(t, err)
	}
}

func TestTempPathValid(t *testing.T) {
	tempPath := TempPath("", "TempPrefix.")
	t.Logf("Temp path: %s", tempPath)
	assert.True(t, strings.HasPrefix(filepath.Base(tempPath), "TempPrefix."))
	assert.Equal(t, len(filepath.Base(tempPath)), 63)
}

func TestTempPathRandFail(t *testing.T) {
	// Replace rand.Read with a failing read
	defaultRandRead := randRead
	defer func() { randRead = defaultRandRead }()
	randRead = func(b []byte) (int, error) {
		return 0, fmt.Errorf("Test rand failure")
	}

	tempPath := TempPath("", "TempPrefix.")
	t.Logf("Temp path: %s", tempPath)
	assert.True(t, strings.HasPrefix(filepath.Base(tempPath), "TempPrefix."))
	assert.Equal(t, len(filepath.Base(tempPath)), 30)
}

func TestIsDirReal(t *testing.T) {
	ok, err := IsDirReal("/invalid")
	assert.Error(t, err)
	assert.False(t, ok)

	path := os.Getenv("GOPATH")
	ok, err = IsDirReal(path)
	assert.NoError(t, err)
	assert.True(t, ok)

	_, filename, _, _ := runtime.Caller(0)
	testFile := filepath.Join(filepath.Dir(filename), "../test/test.zip")
	ok, err = IsDirReal(testFile)
	assert.Error(t, err)
	assert.Equal(t, "Path is not a directory", err.Error())
	assert.False(t, ok)

	// Windows requires privileges to create symbolic links
	symLinkPath := TempPath("", "TestIsDirReal")
	defer RemoveFileAtPath(symLinkPath)
	target := os.TempDir()
	if runtime.GOOS == "windows" {
		err = exec.Command("cmd", "/C", "mklink", "/J", symLinkPath, target).Run()
		assert.NoError(t, err)
	} else {
		err = os.Symlink(target, symLinkPath)
		assert.NoError(t, err)
	}
	ok, err = IsDirReal(symLinkPath)
	assert.Error(t, err)
	assert.Equal(t, "Path is a symlink", err.Error())
	assert.False(t, ok)
}

func TestMoveFileValid(t *testing.T) {
	destinationPath := filepath.Join(TempPath("", "TestMoveFileDestination"), "TestMoveFileDestinationSubdir")
	defer RemoveFileAtPath(destinationPath)

	sourcePath, err := WriteTempFile("TestMoveFile", []byte("test"), 0600)
	defer RemoveFileAtPath(sourcePath)
	assert.NoError(t, err)

	err = MoveFile(sourcePath, destinationPath, "", testLog)
	assert.NoError(t, err)
	exists, err := FileExists(destinationPath)
	assert.NoError(t, err)
	assert.True(t, exists)
	data, err := os.ReadFile(destinationPath)
	assert.NoError(t, err)
	assert.Equal(t, []byte("test"), data)
	srcExists, err := FileExists(sourcePath)
	assert.NoError(t, err)
	assert.False(t, srcExists)

	// Move again with different source data, and overwrite
	sourcePath2, err := WriteTempFile("TestMoveFile", []byte("test2"), 0600)
	assert.NoError(t, err)
	err = MoveFile(sourcePath2, destinationPath, "", testLog)
	assert.NoError(t, err)
	exists, err = FileExists(destinationPath)
	assert.NoError(t, err)
	assert.True(t, exists)
	data2, err := os.ReadFile(destinationPath)
	assert.NoError(t, err)
	assert.Equal(t, []byte("test2"), data2)
	srcExists2, err := FileExists(sourcePath2)
	assert.NoError(t, err)
	assert.False(t, srcExists2)
}

func TestMoveFileDirValid(t *testing.T) {
	destinationPath := filepath.Join(TempPath("", "TestMoveFileDestination"), "TestMoveFileDestinationSubdir")
	defer RemoveFileAtPath(destinationPath)

	sourcePath, err := MakeTempDir("TestMoveDir", 0700)
	defer RemoveFileAtPath(sourcePath)
	assert.NoError(t, err)

	err = MoveFile(sourcePath, destinationPath, "", testLog)
	assert.NoError(t, err)
	exists, err := FileExists(destinationPath)
	assert.NoError(t, err)
	assert.True(t, exists)

	// Move again with different source data, and overwrite
	sourcePath2, err := MakeTempDir("TestMoveDir2", 0700)
	assert.NoError(t, err)
	defer RemoveFileAtPath(sourcePath2)
	err = MoveFile(sourcePath2, destinationPath, "", testLog)
	assert.NoError(t, err)
	exists, err = FileExists(destinationPath)
	assert.NoError(t, err)
	assert.True(t, exists)
}

func TestMoveFileInvalidSource(t *testing.T) {
	sourcePath := "/invalid"
	destinationPath := TempPath("", "TestMoveFileDestination")
	err := MoveFile(sourcePath, destinationPath, "", testLog)
	assert.Error(t, err)

	exists, err := FileExists(destinationPath)
	assert.NoError(t, err)
	assert.False(t, exists)
}

func TestMoveFileInvalidDest(t *testing.T) {
	sourcePath := "/invalid"
	destinationPath := TempPath("", "TestMoveFileDestination")
	err := MoveFile(sourcePath, destinationPath, "", testLog)
	assert.Error(t, err)

	exists, err := FileExists(destinationPath)
	assert.NoError(t, err)
	assert.False(t, exists)
}

func TestCopyFileValid(t *testing.T) {
	destinationPath := filepath.Join(TempPath("", "TestCopyFileDestination"), "TestCopyFileDestinationSubdir")
	defer RemoveFileAtPath(destinationPath)

	sourcePath, err := WriteTempFile("TestCopyFile", []byte("test"), 0600)
	defer RemoveFileAtPath(sourcePath)
	assert.NoError(t, err)

	err = CopyFile(sourcePath, destinationPath, testLog)
	assert.NoError(t, err)
	exists, err := FileExists(destinationPath)
	assert.NoError(t, err)
	assert.True(t, exists)
	data, err := os.ReadFile(destinationPath)
	assert.NoError(t, err)
	assert.Equal(t, []byte("test"), data)

	// Move again with different source data, and overwrite
	sourcePath2, err := WriteTempFile("TestCopyFile", []byte("test2"), 0600)
	assert.NoError(t, err)
	err = CopyFile(sourcePath2, destinationPath, testLog)
	assert.NoError(t, err)
	exists, err = FileExists(destinationPath)
	assert.NoError(t, err)
	assert.True(t, exists)
	data2, err := os.ReadFile(destinationPath)
	assert.NoError(t, err)
	assert.Equal(t, []byte("test2"), data2)
}

func TestCopyFileInvalidSource(t *testing.T) {
	sourcePath := "/invalid"
	destinationPath := TempPath("", "TestCopyFileDestination")
	err := CopyFile(sourcePath, destinationPath, testLog)
	assert.Error(t, err)

	exists, err := FileExists(destinationPath)
	assert.NoError(t, err)
	assert.False(t, exists)
}

func TestCopyFileInvalidDest(t *testing.T) {
	sourcePath := "/invalid"
	destinationPath := TempPath("", "TestCopyFileDestination")
	err := CopyFile(sourcePath, destinationPath, testLog)
	assert.Error(t, err)

	exists, err := FileExists(destinationPath)
	assert.NoError(t, err)
	assert.False(t, exists)
}

func TestCloseNil(t *testing.T) {
	Close(nil)
}

func TestOpenTempFile(t *testing.T) {
	path, tempFile, err := openTempFile("prefix", "suffix", 0)
	defer Close(tempFile)
	defer RemoveFileAtPath(path)
	require.NoError(t, err)
	require.NotNil(t, tempFile)

	basePath := filepath.Base(path)
	assert.True(t, strings.HasPrefix(basePath, "prefix"))
	assert.True(t, strings.HasSuffix(basePath, "suffix"))
}

func TestFileExists(t *testing.T) {
	exists, err := FileExists("/nope")
	assert.NoError(t, err)
	assert.False(t, exists)
}

func TestReadFile(t *testing.T) {
	dataIn := []byte("test")
	sourcePath, err := WriteTempFile("TestReadFile", dataIn, 0600)
	require.NoError(t, err)

	dataOut, err := ReadFile(sourcePath)
	require.NoError(t, err)
	assert.Equal(t, dataIn, dataOut)

	_, err = ReadFile("/invalid")
	assert.Error(t, err)
	require.True(t, strings.HasPrefix(err.Error(), "open /invalid: "))
}

func TestURLStringForPathWindows(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Windows only test")
	}
	assert.Equal(t, "file:///C:/Go/bin", URLStringForPath(`C:\Go\bin`))
	assert.Equal(t, "file:///C:/Program%20Files", URLStringForPath(`C:\Program Files`))
	assert.Equal(t, "file:///C:/test%20%E2%9C%93%E2%9C%93", URLStringForPath(`C:\test ✓✓`))
}

func TestURLStringForPath(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("See TestURLStringForPathWindows")
	}
	assert.Equal(t, "file:///usr/local/go/bin", URLStringForPath("/usr/local/go/bin"))
	assert.Equal(t, "file:///Applications/System%20Preferences.app", URLStringForPath("/Applications/System Preferences.app"))
	assert.Equal(t, "file:///test%20%E2%9C%93%E2%9C%93", URLStringForPath("/test ✓✓"))
}

func TestPathFromURLWindows(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Windows only test")
	}
	url, err := url.Parse("file:///C:/Go/bin")
	require.NoError(t, err)
	assert.Equal(t, `C:\Go\bin`, PathFromURL(url))
}

func TestPathFromURL(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("See TestPathFromURLWindows")
	}
	url, err := url.Parse("file:///usr/local/go/bin")
	require.NoError(t, err)
	assert.Equal(t, "/usr/local/go/bin", PathFromURL(url))

	url, err = url.Parse("file:///Applications/System%20Preferences.app")
	require.NoError(t, err)
	assert.Equal(t, "/Applications/System Preferences.app", PathFromURL(url))
}

func TestTouchModTime(t *testing.T) {
	path, err := RandomID("TestTouchModTime")
	defer RemoveFileAtPath(path)
	require.NoError(t, err)
	now := time.Now()
	err = Touch(path)
	require.NoError(t, err)
	ti, err := FileModTime(path)
	require.NoError(t, err)
	assert.WithinDuration(t, now, ti, time.Second)
	time.Sleep(1 * time.Second)

	// Touch same path, ensure it updates mod time
	err = Touch(path)
	require.NoError(t, err)
	ti2, err := FileModTime(path)
	require.NoError(t, err)
	assert.NotEqual(t, ti, ti2)
}
