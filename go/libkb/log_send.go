// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"mime/multipart"
	"os"
	"strings"

	rogReverse "github.com/rogpeppe/rog-go/reverse"
)

// Logs is the struct to specify the path of log files
type Logs struct {
	Desktop string
	Kbfs    string
	Service string
	Updater string
	Start   string
}

func addFile(mpart *multipart.Writer, param, filename, data string) error {
	if len(data) == 0 {
		return nil
	}

	part, err := mpart.CreateFormFile(param, filename)
	if err != nil {
		return err
	}
	gz := gzip.NewWriter(part)
	if _, err := gz.Write([]byte(data)); err != nil {
		return err
	}
	if err := gz.Close(); err != nil {
		return err
	}

	return nil
}

func (c *Contextified) post(status, kbfsLog, svcLog, desktopLog, updaterLog, startLog string) (string, error) {
	c.G().Log.Debug("sending status + logs to keybase")

	var body bytes.Buffer
	mpart := multipart.NewWriter(&body)

	if err := addFile(mpart, "status_gz", "status.gz", status); err != nil {
		return "", err
	}
	if err := addFile(mpart, "kbfs_log_gz", "kbfs_log.gz", kbfsLog); err != nil {
		return "", err
	}
	if err := addFile(mpart, "keybase_log_gz", "keybase_log.gz", svcLog); err != nil {
		return "", err
	}
	if err := addFile(mpart, "updater_log_gz", "updater_log.gz", updaterLog); err != nil {
		return "", err
	}
	if err := addFile(mpart, "gui_log_gz", "gui_log.gz", desktopLog); err != nil {
		return "", err
	}
	if err := addFile(mpart, "start_log_gz", "start_log.gz", startLog); err != nil {
		return "", err
	}

	if err := mpart.Close(); err != nil {
		return "", err
	}

	c.G().Log.Debug("body size: %d\n", body.Len())

	arg := APIArg{
		Contextified: NewContextified(c.G()),
		Endpoint:     "logdump/send",
	}

	resp, err := c.G().API.PostRaw(arg, mpart.FormDataContentType(), &body)
	if err != nil {
		c.G().Log.Debug("post error: %s", err)
		return "", err
	}

	id, err := resp.Body.AtKey("logdump_id").GetString()
	if err != nil {
		return "", err
	}

	return id, nil
}

func (c *Contextified) tail(filename string, numLines int) string {
	if filename == "" {
		return ""
	}

	f, err := os.Open(filename)
	if err != nil {
		c.G().Log.Warning("error opening log %q: %s", filename, err)
		return ""
	}
	b := rogReverse.NewScanner(f)
	b.Split(bufio.ScanLines)

	var lines []string
	for b.Scan() {
		lines = append(lines, b.Text())
		if len(lines) == numLines {
			break
		}
	}

	for left, right := 0, len(lines)-1; left < right; left, right = left+1, right-1 {
		lines[left], lines[right] = lines[right], lines[left]
	}

	return strings.Join(lines, "\n")
}

// LogSend sends the the tails of log files to kb
func (c *Contextified) LogSend(statusJSON string, logs Logs, numLines int) (string, error) {

	c.G().Log.Debug("tailing kbfs log %q", logs.Kbfs)
	kbfsLog := c.tail(logs.Kbfs, numLines)

	c.G().Log.Debug("tailing service log %q", logs.Service)
	svcLog := c.tail(logs.Service, numLines)

	c.G().Log.Debug("tailing desktop log %q", logs.Desktop)
	desktopLog := c.tail(logs.Desktop, numLines)

	c.G().Log.Debug("tailing updater log %q", logs.Updater)
	updaterLog := c.tail(logs.Updater, numLines)

	c.G().Log.Debug("tailing start log %q", logs.Start)
	startLog := c.tail(logs.Start, numLines)

	return c.post(statusJSON, kbfsLog, svcLog, desktopLog, updaterLog, startLog)
}
