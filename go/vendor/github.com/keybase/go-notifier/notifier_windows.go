// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package notifier

import (
	"fmt"
	"os/exec"
)

type windowsNotifier struct{}

// NewNotifier constructs notifier for Windows
func NewNotifier() (Notifier, error) {
	return &windowsNotifier{}, nil
}

// DeliverNotification sends a notification
func (n windowsNotifier) DeliverNotification(notification Notification) error {
	args := []string{}

	if notification.Title != "" {
		args = append(args, "-t", notification.Title)
	}
	if notification.Message != "" {
		args = append(args, "-m", notification.Message)
	}
	if notification.ImagePath != "" {
		args = append(args, "-p", notification.ImagePath)
	}

	// For testing
	// toastPath := filepath.Join(os.Getenv("GOPATH"), "src/github.com/keybase/go-osnotify/toaster/toast.exe")

	cmd := exec.Command(notification.ToastPath, args...)
	if cmd == nil {
		return fmt.Errorf("No command")
	}
	_, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("Error running command: %s", err)
	}
	return nil
}
