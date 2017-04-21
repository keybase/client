// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"compress/gzip"
	"io"
	"io/ioutil"
	"mime/multipart"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/keybase/client/go/logger"
)

// Logs is the struct to specify the path of log files
type Logs struct {
	Desktop string
	Kbfs    string
	Service string
	Updater string
	Start   string
	Install string
	System  string
}

// LogSendContext for LogSend
type LogSendContext struct {
	Contextified
	Logs Logs
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

func (l *LogSendContext) post(status, feedback, mobileVersionName, mobileVersionCode, kbfsLog, svcLog, desktopLog, updaterLog, startLog, installLog, systemLog string) (string, error) {
	l.G().Log.Debug("sending status + logs to keybase")

	var body bytes.Buffer
	mpart := multipart.NewWriter(&body)

	if feedback != "" {
		mpart.WriteField("feedback", feedback)
	}

	if mobileVersionName != "" {
		mpart.WriteField("mobile_version_name", mobileVersionName)
	}

	if mobileVersionCode != "" {
		mpart.WriteField("mobile_version_code", mobileVersionCode)
	}

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
	if err := addFile(mpart, "install_log_gz", "install_log.gz", installLog); err != nil {
		return "", err
	}
	if err := addFile(mpart, "system_log_gz", "system_log.gz", systemLog); err != nil {
		return "", err
	}

	if err := mpart.Close(); err != nil {
		return "", err
	}

	l.G().Log.Debug("body size: %d\n", body.Len())

	arg := APIArg{
		Endpoint:    "logdump/send",
		SessionType: APISessionTypeOPTIONAL,
	}

	// Get the login session, if any
	l.G().LoginState().LoggedInLoad()

	resp, err := l.G().API.PostRaw(arg, mpart.FormDataContentType(), &body)
	if err != nil {
		l.G().Log.Debug("post error: %s", err)
		return "", err
	}

	id, err := resp.Body.AtKey("logdump_id").GetString()
	if err != nil {
		return "", err
	}

	return id, nil
}

// tail the logs that start with the stem `stem`, which are of type `which`.
// Get the most recent `numBytes` from the concatenation of the files.
func tail(log logger.Logger, which string, stem string, numBytes int) (ret string) {

	numFiles := 0

	log.Debug("+ tailing %s file with stem %q", which, stem)
	defer func() {
		log.Debug("- collected %d bytes from %d files", len(ret), numFiles)
	}()

	if len(stem) == 0 {
		log.Debug("| skipping %s logs (since no stem given)", which)
		return
	}

	lognames := listLogFiles(log, stem)
	var parts []string
	remaining := numBytes

	// Keep reading logs in reverse chronological order until we've read nothing
	// more, or we've filled up numBytes worth of buffer, or we didn't have to read
	// the whole file.
	for _, logname := range lognames {
		data, seeked := tailFile(log, which, logname, remaining)
		if len(data) == 0 {
			break
		}
		parts = append(parts, data)
		numFiles++
		remaining -= len(data)
		if remaining <= 0 || seeked {
			break
		}
	}

	// Reverse the array; took this one-line from StackOverflow answer
	for i, j := 0, len(parts)-1; i < j; i, j = i+1, j-1 {
		parts[i], parts[j] = parts[j], parts[i]
	}

	return strings.Join(parts, "")
}

type nameAndMTime struct {
	name  string
	mtime time.Time
}

type nameAndMTimes []nameAndMTime

func (a nameAndMTimes) Len() int           { return len(a) }
func (a nameAndMTimes) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a nameAndMTimes) Less(i, j int) bool { return a[i].mtime.After(a[j].mtime) }

// List logfiles that match the glob filename*, and return then in reverse chronological order.
// We'll need to read the first, and maybe the second
func listLogFiles(log logger.Logger, stem string) (ret []string) {
	stem = filepath.Clean(stem)
	dir := filepath.Dir(stem)
	base := filepath.Base(stem)
	files, err := ioutil.ReadDir(dir)

	defer func() {
		log.Debug("listLogFiles(%q) -> %v", stem, ret)
	}()

	// In the worst case, just return the stem in an array
	defret := []string{stem}

	if err != nil {
		log.Debug("failed to list directory %q: %s", dir, err)
		return defret
	}

	var tmp []nameAndMTime
	for _, d := range files {
		fullname := filepath.Clean(filepath.Join(dir, d.Name()))
		// Use the stat on the file (and not from the directory read)
		// since the latter doesn't work reliably on Windows
		finfo, err := os.Stat(fullname)
		if err != nil {
			log.Debug("Cannot stat %q: %s", fullname, err)
			continue
		}
		if strings.HasPrefix(d.Name(), base) {
			tmp = append(tmp, nameAndMTime{fullname, finfo.ModTime()})
		}
	}
	if len(tmp) == 0 {
		log.Debug("no files found matching \"%s*\"; falling back to default glob", stem)
		return defret
	}

	// Sort the files in reverse chronological mtime order. We should get the raw stem first.
	sort.Sort(nameAndMTimes(tmp))
	log.Debug("Sorted file list: %+v", tmp)

	for _, f := range tmp {
		ret = append(ret, f.name)
	}

	// If we didn't get the raw stem first, then we have a problem, so just use only the
	// raw stem and ignore the rest of our work.
	if stem != ret[0] {
		log.Debug("Expected to get %q first, but got %q instead! Falling back to one log only", stem, ret[0])
		return defret
	}
	return ret
}

// findFirstNewline first the first newline in the given byte array, and then returns the
// rest of the byte array. Should be safe to use on utf-8 strings.
func findFirstNewline(b []byte) []byte {
	index := bytes.IndexByte(b, '\n')
	if index < 0 || index == len(b)-1 {
		return nil
	}
	return b[(index + 1):]
}

// tailFile takes the last n bytes, but advances to the first newline. Returns the log (as a string)
// and a bool, indicating if we read the full log, or we had to advance into the log to find the newline.
func tailFile(log logger.Logger, which string, filename string, numBytes int) (ret string, seeked bool) {

	log.Debug("+ tailing %s log %q (%d bytes)", which, filename, numBytes)
	defer func() {
		log.Debug("- scanned %d bytes", len(ret))
	}()

	seeked = false
	if filename == "" {
		return ret, seeked
	}
	finfo, err := os.Stat(filename)
	if os.IsNotExist(err) {
		log.Debug("log %q doesn't exist", filename)
		return ret, seeked
	}
	f, err := os.Open(filename)
	if err != nil {
		log.Errorf("error opening log %q: %s", filename, err)
		return ret, seeked
	}
	defer f.Close()
	if finfo.Size() > int64(numBytes) {
		seeked = true
		_, err = f.Seek(int64(-numBytes), io.SeekEnd)
		if err != nil {
			log.Errorf("Can't seek log %q: %s", filename, err)
			return ret, seeked
		}
	}
	buf, err := ioutil.ReadAll(f)
	if err != nil {
		log.Errorf("Failure in reading file %q: %s", filename, err)
		return ret, seeked
	}
	if seeked {
		buf = findFirstNewline(buf)
	}
	return string(buf), seeked
}

// LogSend sends the the tails of log files to kb
func (l *LogSendContext) LogSend(statusJSON, feedback string, mobileVersionName string, mobileVersionCode string, sendLogs bool, numBytes int) (string, error) {
	logs := l.Logs
	var kbfsLog string
	var svcLog string
	var desktopLog string
	var updaterLog string
	var startLog string
	var installLog string
	var systemLog string

	if sendLogs {
		kbfsLog = tail(l.G().Log, "kbfs", logs.Kbfs, numBytes)
		svcLog = tail(l.G().Log, "service", logs.Service, numBytes)
		desktopLog = tail(l.G().Log, "desktop", logs.Desktop, numBytes)
		updaterLog = tail(l.G().Log, "updater", logs.Updater, numBytes)
		startLog = tail(l.G().Log, "start", logs.Start, numBytes)
		installLog = tail(l.G().Log, "install", logs.Install, numBytes)
		systemLog = tail(l.G().Log, "system", logs.System, numBytes)
	} else {
		kbfsLog = ""
		svcLog = ""
		desktopLog = ""
		updaterLog = ""
		startLog = ""
		installLog = ""
		systemLog = ""
	}

	return l.post(statusJSON, feedback, mobileVersionName, mobileVersionCode, kbfsLog, svcLog, desktopLog, updaterLog, startLog, installLog, systemLog)
}
