// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package notifier

import (
	"fmt"
	"os/exec"
)

type linuxNotifier struct{}

// NewNotifier constructs notifier for Windows
func NewNotifier() (Notifier, error) {
	return &linuxNotifier{}, nil
}

// DeliverNotification sends a notification
func (n linuxNotifier) DeliverNotification(notification Notification) error {
	args := []string{}
	if notification.ImagePath != "" {
		args = append(args, "-i", notification.ImagePath)
	}
	args = append(args, notification.Title)
	args = append(args, notification.Message)
	cmd := exec.Command("notify-send", args...)
	if cmd == nil {
		return fmt.Errorf("No command")
	}
	_, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("Error running command: %s", err)
	}
	return nil
}
