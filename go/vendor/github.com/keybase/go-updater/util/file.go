// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"fmt"
	"io"
	"io/ioutil"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// File uses a safer file API
type File struct {
	name string
	data []byte
	perm os.FileMode
}

// SafeWriter defines a writer that is safer (atomic)
type SafeWriter interface {
	GetFilename() string
	WriteTo(io.Writer) (int64, error)
}

// NewFile returns a File
func NewFile(name string, data []byte, perm os.FileMode) File {
	return File{name, data, perm}
}

// Save file
func (f File) Save(log Log) error {
	return safeWriteToFile(f, f.perm, log)
}

// GetFilename returns the file name for SafeWriter
func (f File) GetFilename() string {
	return f.name
}

// WriteTo is for SafeWriter
func (f File) WriteTo(w io.Writer) (int64, error) {
	n, err := w.Write(f.data)
	return int64(n), err
}

// safeWriteToFile to safely write to a file
func safeWriteToFile(t SafeWriter, mode os.FileMode, log Log) error {
	filename := t.GetFilename()
	if filename == "" {
		return fmt.Errorf("No filename")
	}
	log.Debugf("Writing to %s", filename)
	tempFilename, tempFile, err := openTempFile(filename+"-", "", mode)
	log.Debugf("Temporary file generated: %s", tempFilename)
	if err != nil {
		return err
	}
	_, err = t.WriteTo(tempFile)
	if err != nil {
		log.Errorf("Error writing temporary file %s: %s", tempFilename, err)
		_ = tempFile.Close()
		_ = os.Remove(tempFilename)
		return err
	}
	err = tempFile.Close()
	if err != nil {
		log.Errorf("Error closing temporary file %s: %s", tempFilename, err)
		_ = os.Remove(tempFilename)
		return err
	}
	err = os.Rename(tempFilename, filename)
	if err != nil {
		log.Errorf("Error renaming temporary file %s to %s: %s", tempFilename, filename, err)
		_ = os.Remove(tempFilename)
		return err
	}
	log.Debugf("Wrote to %s", filename)
	return nil
}

// Close closes a file and ignores the error.
// This satisfies lint checks when using with defer and you don't care if there
// is an error, so instead of:
//   defer func() { _ = f.Close() }()
//   defer Close(f)
func Close(f io.Closer) {
	if f == nil {
		return
	}
	_ = f.Close()
}

// RemoveFileAtPath removes a file at path (and any children) ignoring any error.
// We do nothing if path == "".
// This satisfies lint checks when using with defer and you don't care if there
// is an error, so instead of:
//   defer func() { _ = os.Remove(path) }()
//   defer RemoveFileAtPath(path)
func RemoveFileAtPath(path string) {
	if path == "" {
		return
	}
	_ = os.RemoveAll(path)
}

// openTempFile creates an opened temporary file.
//
//   openTempFile("foo", ".zip", 0755) => "foo.RCG2KUSCGYOO3PCKNWQHBOXBKACOPIKL.zip"
//   openTempFile(path.Join(os.TempDir(), "foo"), "", 0600) => "/tmp/foo.RCG2KUSCGYOO3PCKNWQHBOXBKACOPIKL"
//
func openTempFile(prefix string, suffix string, mode os.FileMode) (string, *os.File, error) {
	filename, err := RandomID(prefix)
	if err != nil {
		return "", nil, err
	}
	if suffix != "" {
		filename = filename + suffix
	}
	flags := os.O_WRONLY | os.O_CREATE | os.O_EXCL
	if mode == 0 {
		mode = 0600
	}
	file, err := os.OpenFile(filename, flags, mode)
	return filename, file, err
}

// FileExists returns whether the given file or directory exists or not
func FileExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

// MakeParentDirs ensures parent directory exist for path
func MakeParentDirs(path string, mode os.FileMode, log Log) error {
	// 2nd return value here is filename (not an error), which is not needed
	dir, _ := filepath.Split(path)
	if dir == "" {
		return fmt.Errorf("No base directory")
	}
	return MakeDirs(dir, mode, log)
}

// MakeDirs ensures directory exists for path
func MakeDirs(dir string, mode os.FileMode, log Log) error {
	exists, err := FileExists(dir)
	if err != nil {
		return err
	}

	if !exists {
		log.Debugf("Creating: %s\n", dir)
		err = os.MkdirAll(dir, mode)
		if err != nil {
			return err
		}
	}
	return nil
}

// TempPath returns a temporary unique file path.
// If for some reason we can't obtain random data, we still return a valid
// path, which may not be as unique.
// If tempDir is "", then os.TempDir() is used.
func TempPath(tempDir string, prefix string) string {
	if tempDir == "" {
		tempDir = os.TempDir()
	}
	filename, err := RandomID(prefix)
	if err != nil {
		// We had an error getting random bytes, we'll use current nanoseconds
		filename = fmt.Sprintf("%s%d", prefix, time.Now().UnixNano())
	}
	path := filepath.Join(tempDir, filename)
	return path
}

// WriteTempFile creates a unique temp file with data.
//
// For example:
//   WriteTempFile("Test.", byte[]("test data"), 0600)
func WriteTempFile(prefix string, data []byte, mode os.FileMode) (string, error) {
	path := TempPath("", prefix)
	if err := ioutil.WriteFile(path, data, mode); err != nil {
		return "", err
	}
	return path, nil
}

// MakeTempDir creates a unique temp directory.
//
// For example:
//   MakeTempDir("Test.", 0700)
func MakeTempDir(prefix string, mode os.FileMode) (string, error) {
	path := TempPath("", prefix)
	if err := os.MkdirAll(path, mode); err != nil {
		return "", err
	}
	return path, nil
}

// IsDirReal returns true if directory exists and is a real directory (not a symlink).
// If it returns false, an error will be set explaining why.
func IsDirReal(path string) (bool, error) {
	fileInfo, err := os.Lstat(path)
	if err != nil {
		return false, err
	}
	// Check if symlink
	if fileInfo.Mode()&os.ModeSymlink != 0 {
		return false, fmt.Errorf("Path is a symlink")
	}
	if !fileInfo.Mode().IsDir() {
		return false, fmt.Errorf("Path is not a directory")
	}
	return true, nil
}

// MoveFile moves a file safely.
// It will create parent directories for destinationPath if they don't exist.
// If the destination already exists and you specify a tmpDir, it will move
// it there, otherwise it will be removed.
func MoveFile(sourcePath string, destinationPath string, tmpDir string, log Log) error {
	if _, statErr := os.Stat(destinationPath); statErr == nil {
		if tmpDir == "" {
			log.Infof("Removing existing destination path: %s", destinationPath)
			if removeErr := os.RemoveAll(destinationPath); removeErr != nil {
				return removeErr
			}
		} else {
			tmpPath := filepath.Join(tmpDir, filepath.Base(destinationPath))
			log.Infof("Moving existing destination %q to %q", destinationPath, tmpPath)
			if tmpMoveErr := os.Rename(destinationPath, tmpPath); tmpMoveErr != nil {
				return tmpMoveErr
			}
		}
	}

	if err := MakeParentDirs(destinationPath, 0700, log); err != nil {
		return err
	}

	log.Infof("Moving %s to %s", sourcePath, destinationPath)
	// Rename will copy over an existing destination
	return os.Rename(sourcePath, destinationPath)
}

// CopyFile copies a file safely.
// It will create parent directories for destinationPath if they don't exist.
// It will overwrite an existing destinationPath.
func CopyFile(sourcePath string, destinationPath string, log Log) error {
	log.Infof("Copying %s to %s", sourcePath, destinationPath)
	in, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer Close(in)

	if _, statErr := os.Stat(destinationPath); statErr == nil {
		log.Infof("Removing existing destination path: %s", destinationPath)
		if removeErr := os.RemoveAll(destinationPath); removeErr != nil {
			return removeErr
		}
	}

	if makeDirErr := MakeParentDirs(destinationPath, 0700, log); makeDirErr != nil {
		return makeDirErr
	}

	out, err := os.Create(destinationPath)
	if err != nil {
		return err
	}
	defer Close(out)
	_, err = io.Copy(out, in)
	closeErr := out.Close()
	if err != nil {
		return err
	}
	return closeErr
}

// ReadFile returns data for file at path
func ReadFile(path string) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer Close(file)
	data, err := ioutil.ReadAll(file)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func convertPathForWindows(path string) string {
	return "/" + strings.Replace(path, `\`, `/`, -1)
}

// URLStringForPath returns an URL as string with file scheme for path.
// For example,
//     /usr/local/go/bin => file:///usr/local/go/bin
//     C:\Go\bin => file:///C:/Go/bin
func URLStringForPath(path string) string {
	if runtime.GOOS == "windows" {
		path = convertPathForWindows(path)
	}
	u := &url.URL{Path: path}
	encodedPath := u.String()
	return fmt.Sprintf("%s://%s", fileScheme, encodedPath)
}

// PathFromURL returns path for file URL scheme
// For example,
//     file:///usr/local/go/bin => /usr/local/go/bin
//     file:///C:/Go/bin => C:\Go\bin
func PathFromURL(u *url.URL) string {
	path := u.Path
	if runtime.GOOS == "windows" && u.Scheme == fileScheme {
		// Remove leading slash for Windows
		if strings.HasPrefix(path, "/") {
			path = path[1:]
		}
		path = filepath.FromSlash(path)
	}
	return path
}

// Touch a file, updating its modification time
func Touch(path string) error {
	f, err := os.OpenFile(path, os.O_RDONLY|os.O_CREATE|os.O_TRUNC, 0600)
	Close(f)
	return err
}

// FileModTime returns modification time for file.
// If file doesn't exist returns error.
func FileModTime(path string) (time.Time, error) {
	info, err := os.Stat(path)
	if err != nil {
		return time.Time{}, err
	}
	return info.ModTime(), nil
}
