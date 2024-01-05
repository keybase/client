// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

const fileScheme = "file"

func discardAndClose(rc io.ReadCloser) error {
	_, _ = io.Copy(io.Discard, rc)
	return rc.Close()
}

// DiscardAndCloseBody reads as much as possible from the body of the
// given response, and then closes it.
//
// This is because, in order to free up the current connection for
// re-use, a response body must be read from before being closed; see
// http://stackoverflow.com/a/17953506 .
//
// Instead of doing:
//
//	res, _ := ...
//	defer res.Body.Close()
//
// do
//
//	res, _ := ...
//	defer DiscardAndCloseBody(res)
//
// instead.
func DiscardAndCloseBody(resp *http.Response) error {
	if resp == nil {
		return fmt.Errorf("Nothing to discard (http.Response was nil)")
	}
	return discardAndClose(resp.Body)
}

// SaveHTTPResponse saves an http.Response to path
func SaveHTTPResponse(resp *http.Response, savePath string, mode os.FileMode, log Log) error {
	if resp == nil {
		return fmt.Errorf("No response")
	}
	file, err := os.OpenFile(savePath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, mode)
	if err != nil {
		return err
	}
	defer Close(file)

	log.Infof("Downloading to %s", savePath)
	n, err := io.Copy(file, resp.Body)
	if err == nil {
		log.Infof("Downloaded %d bytes", n)
	}
	return err
}

// DiscardAndCloseBodyIgnoreError calls DiscardAndCloseBody.
// This satisfies lint checks when using with defer and you don't care if there
// is an error, so instead of:
//
//	defer func() { _ = DiscardAndCloseBody(resp) }()
//	defer DiscardAndCloseBodyIgnoreError(resp)
func DiscardAndCloseBodyIgnoreError(resp *http.Response) {
	_ = DiscardAndCloseBody(resp)
}

// parseURL ensures error if parse error or no url was returned from url.Parse
func parseURL(urlString string) (*url.URL, error) {
	url, parseErr := url.Parse(urlString)
	if parseErr != nil {
		return nil, parseErr
	}
	if url == nil {
		return nil, fmt.Errorf("No URL")
	}
	return url, nil
}

// URLExists returns error if URL doesn't exist
func URLExists(urlString string, timeout time.Duration, log Log) (bool, error) {
	url, err := parseURL(urlString)
	if err != nil {
		return false, err
	}

	// Handle local files
	if url.Scheme == "file" {
		return FileExists(PathFromURL(url))
	}

	log.Debugf("Checking URL exists: %s", urlString)
	req, err := http.NewRequest("HEAD", urlString, nil)
	if err != nil {
		return false, err
	}
	client := &http.Client{
		Timeout: timeout,
	}
	resp, requestErr := client.Do(req)
	if requestErr != nil {
		return false, requestErr
	}
	if resp == nil {
		return false, fmt.Errorf("No response")
	}
	defer DiscardAndCloseBodyIgnoreError(resp)
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("Invalid status code (%d)", resp.StatusCode)
	}
	return true, nil
}

// DownloadURLOptions are options for DownloadURL
type DownloadURLOptions struct {
	Digest        string
	RequireDigest bool
	UseETag       bool
	Timeout       time.Duration
	Log           Log
}

// DownloadURL downloads a URL to a path.
func DownloadURL(urlString string, destinationPath string, options DownloadURLOptions) error {
	_, err := downloadURL(urlString, destinationPath, options)
	return err
}

func downloadURL(urlString string, destinationPath string, options DownloadURLOptions) (cached bool, _ error) {
	log := options.Log

	url, err := parseURL(urlString)
	if err != nil {
		return false, err
	}

	// Handle local files
	if url.Scheme == fileScheme {
		return cached, downloadLocal(PathFromURL(url), destinationPath, options)
	}

	// Compute ETag if the destinationPath already exists
	etag := ""
	if options.UseETag {
		if _, statErr := os.Stat(destinationPath); statErr == nil {
			computedEtag, etagErr := ComputeEtag(destinationPath)
			if etagErr != nil {
				log.Warningf("Error computing etag", etagErr)
			} else {
				etag = computedEtag
			}
		}
	}

	req, err := http.NewRequest("GET", url.String(), nil)
	if err != nil {
		return cached, err
	}
	if etag != "" {
		log.Infof("Using etag: %s", etag)
		req.Header.Set("If-None-Match", etag)
	}
	var client http.Client
	if options.Timeout > 0 {
		client = http.Client{Timeout: options.Timeout}
	} else {
		client = http.Client{}
	}
	log.Infof("Request %s", url.String())
	resp, requestErr := client.Do(req)
	if requestErr != nil {
		return cached, requestErr
	}
	if resp == nil {
		return cached, fmt.Errorf("No response")
	}
	defer DiscardAndCloseBodyIgnoreError(resp)
	if resp.StatusCode == http.StatusNotModified {
		cached = true
		// ETag matched, we already have it
		log.Infof("Using cached file: %s", destinationPath)
		return cached, nil
	}
	if resp.StatusCode != http.StatusOK {
		return cached, fmt.Errorf("Responded with %s", resp.Status)
	}

	savePath := fmt.Sprintf("%s.download", destinationPath)
	if _, ferr := os.Stat(savePath); ferr == nil {
		log.Infof("Removing existing partial download: %s", savePath)
		if rerr := os.Remove(savePath); rerr != nil {
			return cached, fmt.Errorf("Error removing existing partial download: %s", rerr)
		}
	}

	if err := MakeParentDirs(savePath, 0700, log); err != nil {
		return cached, err
	}

	if err := SaveHTTPResponse(resp, savePath, 0600, log); err != nil {
		return cached, err
	}

	if options.RequireDigest {
		if err := CheckDigest(options.Digest, savePath, log); err != nil {
			return cached, err
		}
	}

	if err := MoveFile(savePath, destinationPath, "", log); err != nil {
		return cached, err
	}

	return cached, nil
}

func downloadLocal(localPath string, destinationPath string, options DownloadURLOptions) error {
	if err := CopyFile(localPath, destinationPath, options.Log); err != nil {
		return err
	}

	if options.RequireDigest {
		if err := CheckDigest(options.Digest, destinationPath, options.Log); err != nil {
			return err
		}
	}
	return nil
}

// URLValueForBool returns "1" for true, otherwise "0"
func URLValueForBool(b bool) string {
	if b {
		return "1"
	}
	return "0"
}
