// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"archive/zip"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
)

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
//   UnzipOver("/tmp/Keybase-1.2.3.zip", "Keybase.app", "/Applications/Keybase.app", check, "", log)
//
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
		err := os.RemoveAll(destinationPath)
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

	err = os.MkdirAll(destinationPath, 0755)
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

		filePath := filepath.Join(destinationPath, f.Name)
		fileInfo := f.FileInfo()

		if fileInfo.IsDir() {
			err := os.MkdirAll(filePath, fileInfo.Mode())
			if err != nil {
				return err
			}
		} else {
			err := os.MkdirAll(filepath.Dir(filePath), 0755)
			if err != nil {
				return err
			}

			if fileInfo.Mode()&os.ModeSymlink != 0 {
				linkName, readErr := ioutil.ReadAll(rc)
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

			_, err = io.Copy(fileCopy, rc)
			if err != nil {
				return err
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
