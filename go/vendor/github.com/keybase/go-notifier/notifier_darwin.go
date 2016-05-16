// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package notifier

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa -sectcreate __TEXT __info_plist Info.plist
#import <Cocoa/Cocoa.h>
extern CFStringRef deliverNotification(CFStringRef title, CFStringRef subtitle, CFStringRef message, CFStringRef appIconURLString, CFArrayRef actions, CFStringRef groupID, CFStringRef bundleID, NSTimeInterval timeout);
*/
import "C"
import "fmt"

type darwinNotifier struct{}

// NewNotifier constructs notifier for Windows
func NewNotifier() (Notifier, error) {
	return &darwinNotifier{}, nil
}

// DeliverNotification sends a notification
func (n darwinNotifier) DeliverNotification(notification Notification) error {
	titleRef, err := StringToCFString(notification.Title)
	if err != nil {
		return err
	}
	defer Release(C.CFTypeRef(titleRef))
	messageRef, err := StringToCFString(notification.Message)
	if err != nil {
		return err
	}
	defer Release(C.CFTypeRef(messageRef))

	var bundleIDRef C.CFStringRef
	if notification.BundleID != "" {
		bundleIDRef, err = StringToCFString(notification.BundleID)
		if err != nil {
			return err
		}
		defer Release(C.CFTypeRef(bundleIDRef))
	}

	var appIconURLStringRef C.CFStringRef
	if notification.ImagePath != "" {
		appIconURLString := fmt.Sprintf("file://%s", notification.ImagePath)
		appIconURLStringRef, err = StringToCFString(appIconURLString)
		if err != nil {
			return err
		}
		defer Release(C.CFTypeRef(appIconURLStringRef))
	}

	actionsRef := StringsToCFArray(notification.Actions)
	defer Release(C.CFTypeRef(actionsRef))

	C.deliverNotification(titleRef, nil, messageRef, appIconURLStringRef, actionsRef, bundleIDRef, nil, C.NSTimeInterval(notification.Timeout))

	return nil
}
