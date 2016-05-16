// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package notifier

// Notification defines a notification
type Notification struct {
	Title     string
	Message   string
	ImagePath string

	// For darwin
	Actions  []string
	Timeout  float64
	BundleID string

	// For windows
	ToastPath string // Path to toast.exe
}

// Notifier knows how to deliver a notification
type Notifier interface {
	DeliverNotification(notification Notification) error
}
