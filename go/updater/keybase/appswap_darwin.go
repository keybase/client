// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"syscall"
	"time"

	"github.com/keybase/client/go/updater/command"
	"github.com/keybase/client/go/updater/util"
)

// appRequirement is the code signing requirement an update's app bundle must
// satisfy: signed by Apple's Developer ID (or Mac App Store) chain with
// Keybase's team ID, and identified as the Keybase app. It is the designated
// requirement Xcode issues for a Developer ID signature; view an app's with
// `codesign -d -r- /Applications/Keybase.app`.
const appRequirement = `anchor apple generic and (certificate leaf[field.1.2.840.113635.100.6.1.9] /* exists */ or certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = "99229SGT5K") and (identifier "keybase.Keybase" or identifier "keybase.Electron")`

// codesignVerifyArgs checks the signature strictly, of nested code too, for
// every architecture, against appRequirement.
func codesignVerifyArgs(path string) []string {
	return []string{"--verify", "--deep", "--strict", "--all-architectures", "--test-requirement==" + appRequirement, path}
}

// verifyAppSignature is a variable so a manual test can make it fail.
var verifyAppSignature = func(path string, log Log) error {
	result, err := command.Exec("/usr/bin/codesign", codesignVerifyArgs(path), time.Minute, log)
	if err != nil {
		return fmt.Errorf("code signature check of %s failed: %w: %s", path, err, result.CombinedOutput())
	}
	return nil
}

// contentsSwap moves Source into Destination, keeping the old Destination at
// Backup until the result has been checked.
type contentsSwap struct {
	Source, Destination, Backup string
}

// planContentsSwap swaps the app's Contents for the update's. The backup sits
// next to the update's Contents, outside the app bundle, so it is cleaned up
// with the unzipped update.
func planContentsSwap(sourcePath, destinationPath, unzipPath string) contentsSwap {
	return contentsSwap{
		Source:      filepath.Join(sourcePath, "Contents"),
		Destination: filepath.Join(destinationPath, "Contents"),
		Backup:      filepath.Join(unzipPath, "Contents.previous"),
	}
}

// planStagedContentsSwap is for an update unzipped on another volume than the
// app, where renames between the two fail. The update is first copied to a
// staging bundle inside the app; renames stay on the app's volume. The
// staging directory must be removed before the app's signature is checked,
// since anything next to Contents breaks it.
func planStagedContentsSwap(destinationPath string) (stagingDir, stagedBundle string, p contentsSwap) {
	stagingDir = filepath.Join(destinationPath, "Contents.incoming")
	stagedBundle = filepath.Join(stagingDir, filepath.Base(destinationPath))
	return stagingDir, stagedBundle, contentsSwap{
		Source:      filepath.Join(stagedBundle, "Contents"),
		Destination: filepath.Join(destinationPath, "Contents"),
		Backup:      filepath.Join(stagingDir, "Contents.previous"),
	}
}

// swapError is a failed contentsSwap. Restore is the error putting the old
// Contents back, if that failed too.
type swapError struct {
	Move, Restore error
}

func (e *swapError) Error() string {
	if e.Restore != nil {
		return fmt.Sprintf("%s; restoring the previous Contents also failed: %s", e.Move, e.Restore)
	}
	return e.Move.Error()
}

func (e *swapError) Unwrap() []error {
	return []error{e.Move, e.Restore}
}

// runContentsSwap moves Destination to Backup, then Source to Destination.
// If the second move fails it moves Backup back.
func runContentsSwap(p contentsSwap, rename func(oldpath, newpath string) error) error {
	if err := rename(p.Destination, p.Backup); err != nil {
		return &swapError{Move: err}
	}
	if err := rename(p.Source, p.Destination); err != nil {
		return &swapError{Move: err, Restore: rename(p.Backup, p.Destination)}
	}
	return nil
}

// rollbackContentsSwap undoes a completed runContentsSwap.
func rollbackContentsSwap(p contentsSwap, rename func(oldpath, newpath string) error) error {
	if err := rename(p.Destination, p.Source); err != nil {
		return err
	}
	return rename(p.Backup, p.Destination)
}

// userSwapFailure is a failed unprivileged swap.
type userSwapFailure struct {
	err error
	// stranded is where the previous Contents is when it could not be put
	// back; empty otherwise.
	stranded string
}

func (f *userSwapFailure) Error() string { return f.err.Error() }
func (f *userSwapFailure) Unwrap() error { return f.err }

func restoreFailed(err error) bool {
	var se *swapError
	return errors.As(err, &se) && se.Restore != nil
}

// swapContentsAsUser replaces the app's Contents with the update's, without
// privileges, and checks the result's signature, rolling back on failure.
// This works when the user can write inside the app bundle but not rename
// it.
func (c context) swapContentsAsUser(sourcePath, destinationPath, unzipPath string) error {
	p := planContentsSwap(sourcePath, destinationPath, unzipPath)
	err := runContentsSwap(p, os.Rename)
	if errors.Is(err, syscall.EXDEV) {
		c.log.Infof("The update is on another volume than %s; copying it in first", destinationPath)
		return c.swapContentsStaged(sourcePath, destinationPath)
	}
	if err != nil {
		f := &userSwapFailure{err: err}
		if restoreFailed(err) {
			f.stranded = p.Backup
		}
		return f
	}
	if err := verifyAppSignature(destinationPath, c.log); err != nil {
		if rbErr := rollbackContentsSwap(p, os.Rename); rbErr != nil {
			c.log.Errorf("Rolling back the update failed; the previous Contents is at %s: %s", p.Backup, rbErr)
			return &userSwapFailure{err: err, stranded: p.Backup}
		}
		return &userSwapFailure{err: err}
	}
	return nil
}

func (c context) swapContentsStaged(sourcePath, destinationPath string) error {
	stagingDir, stagedBundle, p := planStagedContentsSwap(destinationPath)
	if err := os.RemoveAll(stagingDir); err != nil {
		return &userSwapFailure{err: err}
	}
	if err := os.MkdirAll(stagingDir, 0o755); err != nil {
		return &userSwapFailure{err: err}
	}
	if result, err := command.Exec("/usr/bin/ditto", []string{sourcePath, stagedBundle}, 10*time.Minute, c.log); err != nil {
		util.RemoveFileAtPath(stagingDir)
		return &userSwapFailure{err: fmt.Errorf("copying the update failed: %w: %s", err, result.CombinedOutput())}
	}
	// The copy is checked before the swap: once the old Contents is removed
	// from the staging directory there is nothing to roll back to.
	if err := verifyAppSignature(stagedBundle, c.log); err != nil {
		util.RemoveFileAtPath(stagingDir)
		return &userSwapFailure{err: err}
	}
	if err := runContentsSwap(p, os.Rename); err != nil {
		f := &userSwapFailure{err: err}
		if restoreFailed(err) {
			f.stranded = p.Backup
		} else {
			util.RemoveFileAtPath(stagingDir)
		}
		return f
	}
	if err := os.RemoveAll(stagingDir); err != nil {
		c.log.Errorf("Unable to remove %s, which breaks the app's signature: %s", stagingDir, err)
	}
	if err := verifyAppSignature(destinationPath, c.log); err != nil {
		c.log.Errorf("The updated app failed its signature check after a staged copy that passed it; it cannot be rolled back: %s", err)
		return &userSwapFailure{err: err}
	}
	return nil
}

// applyRenameFallback installs the update when the app bundle cannot be
// renamed. It checks the update's signature, then swaps the app's Contents in
// place as the user and checks the result's signature. It never asks for
// administrator privileges.
func (c context) applyRenameFallback(localPath, destinationPath string) error {
	unzipPath, err := util.UnzipPath(localPath, c.log)
	keepUnzipPath := false
	defer func() {
		if !keepUnzipPath {
			util.RemoveFileAtPath(unzipPath)
		}
	}()
	if err != nil {
		return err
	}
	sourcePath := filepath.Join(unzipPath, filepath.Base(destinationPath))

	if err := verifyAppSignature(sourcePath, c.log); err != nil {
		return err
	}

	err = c.swapContentsAsUser(sourcePath, destinationPath, unzipPath)
	var f *userSwapFailure
	if errors.As(err, &f) && f.stranded != "" {
		keepUnzipPath = true
		c.log.Errorf("%s may have no Contents; the previous Contents is at %s", destinationPath, f.stranded)
	}
	return err
}
