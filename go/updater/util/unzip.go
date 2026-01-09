// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// MaxDecompressedSize is the maximum size of a decompressed file to prevent decompression bombs
const MaxDecompressedSize = 5 * 1024 * 1024 // 500MB limit for updater packages

// removeAllWithRetry attempts to remove a directory, retrying on Windows if files are locked.
// Windows can briefly lock files after they're created/accessed, especially in freshly extracted directories.
func removeAllWithRetry(path string, log Log) error {
	err := os.RemoveAll(path)
	if err == nil {
		return nil
	}

	// On Windows, retry if we get a "file is being used by another process" error
	if runtime.GOOS == "windows" && strings.Contains(err.Error(), "being used by another process") {
		log.Infof("File locked on Windows, retrying removal of %s", path)
		maxRetries := 3
		for i := 0; i < maxRetries; i++ {
			time.Sleep(100 * time.Millisecond * time.Duration(i+1)) // Exponential backoff: 100ms, 200ms, 300ms
			err = os.RemoveAll(path)
			if err == nil {
				log.Infof("Successfully removed %s after %d retries", path, i+1)
				return nil
			}
			if !strings.Contains(err.Error(), "being used by another process") {
				// Different error, don't retry
				break
			}
		}
	}

	return err
}

// UnzipOver safely unzips a file and copies it contents to a destination path.
// If destination path exists, it will be removed first.
// The filename must have a ".zip" extension.
// You can specify a check function, which will run before moving the unzipped
// directory into place.
// If you specify a tmpDir and destination path exists, it will be moved there
// instead of being removed.
//
// To unzip Keybase-1.2.3.zip and move the contents Keybase.app to /Applications/Keybase.app
//
//	UnzipOver("/tmp/Keybase-1.2.3.zip", "Keybase.app", "/Applications/Keybase.app", check, "", log)
func UnzipOver(sourcePath string, path string, destinationPath string, check func(sourcePath, destinationPath string) error, tmpDir string, log Log) error {
	unzipPath := fmt.Sprintf("%s.unzipped", sourcePath)
	defer RemoveFileAtPath(unzipPath)
	err := unzipOver(sourcePath, unzipPath, log)
	if err != nil {
		return err
	}

	contentPath := filepath.Join(unzipPath, path)

	err = check(contentPath, destinationPath)
	if err != nil {
		return err
	}

	return MoveFile(contentPath, destinationPath, tmpDir, log)
}

// UnzipPath unzips and returns path to unzipped directory
func UnzipPath(sourcePath string, log Log) (string, error) {
	unzipPath := fmt.Sprintf("%s.unzipped", sourcePath)
	err := unzipOver(sourcePath, unzipPath, log)
	if err != nil {
		return "", err
	}
	return unzipPath, nil
}

func unzipOver(sourcePath string, destinationPath string, log Log) error {
	if destinationPath == "" {
		return fmt.Errorf("Invalid destination %q", destinationPath)
	}

	if _, ferr := os.Stat(destinationPath); ferr == nil {
		log.Infof("Removing existing unzip destination path: %s", destinationPath)
		err := removeAllWithRetry(destinationPath, log)
		if err != nil {
			return err
		}
	}

	log.Infof("Unzipping %q to %q", sourcePath, destinationPath)
	return Unzip(sourcePath, destinationPath, log)
}

// Unzip unpacks a zip file to a destination.
// This unpacks files using the current user and time (it doesn't preserve).
// This code was modified from https://stackoverflow.com/questions/20357223/easy-way-to-unzip-file-with-golang/20357902
func Unzip(sourcePath, destinationPath string, log Log) error {
	r, err := zip.OpenReader(sourcePath)
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := r.Close(); closeErr != nil {
			log.Warningf("Error in unzip closing zip file: %s", closeErr)
		}
	}()

	err = os.MkdirAll(destinationPath, 0o755)
	if err != nil {
		return err
	}

	// Closure to address file descriptors issue with all the deferred .Close() methods
	extractAndWriteFile := func(f *zip.File) error {
		rc, err := f.Open()
		if err != nil {
			return err
		}
		defer func() {
			if err := rc.Close(); err != nil {
				log.Warningf("Error in unzip closing file: %s", err)
			}
		}()

		filePath := filepath.Join(destinationPath, f.Name) //nolint:gosec // G305: Path traversal check on lines 138-141

		// G305: Prevent path traversal attacks
		if !strings.HasPrefix(filepath.Clean(filePath), filepath.Clean(destinationPath)+string(os.PathSeparator)) {
			return fmt.Errorf("zip slip vulnerability: %s is outside of %s", f.Name, destinationPath)
		}

		fileInfo := f.FileInfo()

		if fileInfo.IsDir() {
			err := os.MkdirAll(filePath, fileInfo.Mode())
			if err != nil {
				return err
			}
		} else {
			err := os.MkdirAll(filepath.Dir(filePath), 0o755)
			if err != nil {
				return err
			}

			if fileInfo.Mode()&os.ModeSymlink != 0 {
				linkName, readErr := io.ReadAll(rc)
				if readErr != nil {
					return readErr
				}
				return os.Symlink(string(linkName), filePath)
			}

			fileCopy, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, fileInfo.Mode())
			if err != nil {
				return err
			}
			defer Close(fileCopy)

			// G110: Limit the size of the decompressed file to prevent decompression bombs
			limitedReader := &io.LimitedReader{R: rc, N: MaxDecompressedSize}
			n, err := io.Copy(fileCopy, limitedReader)
			if err != nil && err != io.EOF {
				return err
			}
			if limitedReader.N == 0 && n == MaxDecompressedSize {
				return fmt.Errorf("file %s exceeds maximum decompressed size of %d bytes", f.Name, MaxDecompressedSize)
			}
		}

		return nil
	}

	for _, f := range r.File {
		err := extractAndWriteFile(f)
		if err != nil {
			return err
		}
	}

	return nil
}
