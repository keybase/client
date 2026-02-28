// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package update

import "time"

// Asset describes a downloadable file.
type Asset struct {
	Name      string `codec:"name" json:"name"`
	URL       string `codec:"url" json:"url"`
	Digest    string `codec:"digest" json:"digest"`
	Signature string `codec:"signature" json:"signature"`
	LocalPath string `codec:"localPath" json:"localPath"`
}

// Type is the type of update
type Type int

const (
	// Normal is a normal update
	Normal Type = 0
	// Bugfix is a bugfix
	Bugfix Type = 1
	// Critical is critical
	Critical Type = 2
)

// Property is a generic key value pair for custom properties
type Property struct {
	Name  string `codec:"name" json:"name"`
	Value string `codec:"value" json:"value"`
}

// Update defines an update
type Update struct {
	Version      string     `codec:"version" json:"version"`
	Name         string     `codec:"name" json:"name"`
	Description  string     `codec:"description" json:"description"`
	Instructions *string    `codec:"instructions,omitempty" json:"instructions,omitempty"`
	Type         Type       `codec:"type" json:"type"`
	PublishedAt  *Time      `codec:"publishedAt,omitempty" json:"publishedAt,omitempty"`
	Props        []Property `codec:"props" json:"props,omitempty"`
	Asset        *Asset     `codec:"asset,omitempty" json:"asset,omitempty"`
}

// Time as millis
type Time int64

// FromTime converts millis to Time
func FromTime(t Time) time.Time {
	if t == 0 {
		return time.Time{}
	}
	return time.Unix(0, int64(t)*1000000)
}

// ToTime converts Time to millis
func ToTime(t time.Time) Time {
	// the result of calling UnixNano on the zero Time is undefined.
	// https://golang.org/pkg/time/#Time.UnixNano
	if t.IsZero() {
		return 0
	}
	return Time(t.UnixNano() / 1000000)
}
