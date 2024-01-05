// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package update

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

func urlStringForKey(key string, bucketName string, prefix string) (string, string) {
	name := key[len(prefix):]
	return fmt.Sprintf("https://s3.amazonaws.com/%s/%s%s", bucketName, prefix, url.QueryEscape(name)), name
}

func urlString(bucketName string, prefix string, name string) string {
	if prefix == "" {
		return fmt.Sprintf("https://s3.amazonaws.com/%s/%s", bucketName, url.QueryEscape(name))
	}
	return fmt.Sprintf("https://s3.amazonaws.com/%s/%s%s", bucketName, prefix, url.QueryEscape(name))
}

func urlStringNoEscape(bucketName string, name string) string {
	return fmt.Sprintf("https://s3.amazonaws.com/%s/%s", bucketName, name)
}

func makeParentDirs(filename string) error {
	dir, _ := filepath.Split(filename)
	exists, err := fileExists(dir)
	if err != nil {
		return err
	}

	if !exists {
		err = os.MkdirAll(dir, 0755)
		if err != nil {
			return err
		}
	}
	return nil
}

func fileExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

// CombineErrors returns a single error for multiple errors, or nil if none
func CombineErrors(errs ...error) error {
	errs = RemoveNilErrors(errs)
	if len(errs) == 0 {
		return nil
	} else if len(errs) == 1 {
		return errs[0]
	}

	msgs := []string{}
	for _, err := range errs {
		msgs = append(msgs, err.Error())
	}
	return fmt.Errorf("There were multiple errors: %s", strings.Join(msgs, "; "))
}

// RemoveNilErrors returns error slice with nil errors removed
func RemoveNilErrors(errs []error) []error {
	var r []error
	for _, err := range errs {
		if err != nil {
			r = append(r, err)
		}
	}
	return r
}

// RandomID returns a random identifier
func RandomID() (string, error) {
	buf, err := RandBytes(32)
	if err != nil {
		return "", err
	}
	str := base32.StdEncoding.EncodeToString(buf)
	str = strings.ReplaceAll(str, "=", "")
	return str, nil
}

var randRead = rand.Read

// RandBytes returns random bytes of length
func RandBytes(length int) ([]byte, error) {
	buf := make([]byte, length)
	if _, err := randRead(buf); err != nil {
		return nil, err
	}
	return buf, nil
}
