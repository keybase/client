// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
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
	Git     string
	Trace   string
}

// LogSendContext for LogSend
type LogSendContext struct {
	Contextified
	Logs Logs
}

func addFile(mpart *multipart.Writer, param, filename string, data []byte) error {
	if len(data) == 0 {
		return nil
	}

	part, err := mpart.CreateFormFile(param, filename)
	if err != nil {
		return err
	}
	_, err = io.Copy(part, bytes.NewBuffer(data))
	return err
}

func addGzippedFile(mpart *multipart.Writer, param, filename, data string) error {
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
	return gz.Close()
}

func (l *LogSendContext) post(status, feedback, kbfsLog, svcLog, desktopLog, updaterLog, startLog, installLog, systemLog, gitLog string, traceBundle []byte) (string, error) {
	l.G().Log.Debug("sending status + logs to keybase")

	var body bytes.Buffer
	mpart := multipart.NewWriter(&body)

	if feedback != "" {
		mpart.WriteField("feedback", feedback)
	}

	if err := addGzippedFile(mpart, "status_gz", "status.gz", status); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "kbfs_log_gz", "kbfs_log.gz", kbfsLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "keybase_log_gz", "keybase_log.gz", svcLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "updater_log_gz", "updater_log.gz", updaterLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "gui_log_gz", "gui_log.gz", desktopLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "start_log_gz", "start_log.gz", startLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "install_log_gz", "install_log.gz", installLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "system_log_gz", "system_log.gz", systemLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "git_log_gz", "git_log.gz", gitLog); err != nil {
		return "", err
	}

	if len(traceBundle) > 0 {
		l.G().Log.Debug("trace bundle size: %d", len(traceBundle))
		if err := addFile(mpart, "trace_tar_gz", "trace.tar.gz", traceBundle); err != nil {
			return "", err
		}
	}

	if err := mpart.Close(); err != nil {
		return "", err
	}

	l.G().Log.Debug("body size: %d", body.Len())

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

func appendError(log logger.Logger, collected []byte, format string, args ...interface{}) []byte {
	msg := "Error reading logs: " + fmt.Sprintf(format, args...)
	log.Errorf(msg)
	return append(collected, []byte("\n"+msg+"\n")...)
}

// Get logs from the systemd journal. Currently we don't use this for most of
// our logging, since it's not persisted across boot on some systems. But we do
// use it for startup logs.
func tailSystemdJournal(log logger.Logger, userUnits []string, numBytes int) (ret string) {
	log.Debug("+ tailing journalctl for %#v (%d bytes)", userUnits, numBytes)
	defer func() {
		log.Debug("- scanned %d bytes", len(ret))
	}()

	// Journalctl doesn't provide a "last N bytes" flag directly, so instead we
	// use "last N lines". Large log files in practice seem to be about 150
	// bits per line. We'll request lines on that assumption, but if we get
	// more than 2x as many bytes as we expected, we'll stop reading and
	// include a big error.
	guessedLines := numBytes / 150
	maxBytes := numBytes * 2

	// We intentionally avoid the --user flag to journalctl. That would make us
	// skip over the system journal, but in e.g. Ubuntu 16.04, that's where
	// user units write their logs.
	args := []string{
		"--lines=" + strconv.Itoa(guessedLines),
	}
	if len(userUnits) == 0 {
		panic("without --user-unit we would scrape all system logs!!!")
	}
	for _, userUnit := range userUnits {
		args = append(args, "--user-unit="+userUnit)
	}
	journalCmd := exec.Command("journalctl", args...)
	journalCmd.Stderr = os.Stderr
	stdout, err := journalCmd.StdoutPipe()
	if err != nil {
		msg := fmt.Sprintf("Failed to open a pipe for journalctl: %s", err)
		log.Errorf(msg)
		return msg
	}
	err = journalCmd.Start()
	if err != nil {
		msg := fmt.Sprintf("Failed to run journalctl: %s", err)
		log.Errorf(msg)
		return msg
	}

	// Once we start reading output, don't short-circuit on errors. Just log
	// them, and return whatever we got.
	stdoutLimited := io.LimitReader(stdout, int64(maxBytes))
	output, err := ioutil.ReadAll(stdoutLimited)
	if err != nil {
		output = appendError(log, output, "Error reading from journalctl pipe: %s", err)
	}
	// We must close stdout before Wait, or else Wait might deadlock.
	stdout.Close()
	err = journalCmd.Wait()
	if err != nil {
		output = appendError(log, output, "Journalctl exited with an error: %s", err)
	}
	if len(output) >= maxBytes {
		output = appendError(log, output, "Journal lines longer than expected. Logs truncated.")
	}
	return string(output)
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

func addFileToTar(tw *tar.Writer, path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	if stat, err := file.Stat(); err == nil {
		header := tar.Header{
			Typeflag: tar.TypeReg,
			Name:     filepath.Base(path),
			Size:     stat.Size(),
			Mode:     int64(0600),
			ModTime:  stat.ModTime(),
		}
		if err := tw.WriteHeader(&header); err != nil {
			return err
		}
		if _, err := io.Copy(tw, file); err != nil {
			return err
		}
	}
	return nil
}

func addFilesToTarGz(log logger.Logger, w io.Writer, paths []string) bool {
	gw := gzip.NewWriter(w)
	defer gw.Close()
	tw := tar.NewWriter(gw)
	defer tw.Close()

	added := false
	for _, path := range paths {
		err := addFileToTar(tw, path)
		if err != nil {
			log.Warning("Error adding %q to tar file: %s", path, err)
			continue
		}
		log.Debug("Added trace file %q", path)
		added = true
	}
	return added
}

// Keep in sync with maxTraceFileCount in service/pprof.go.
const maxTraceFileCount = 5

func getTraceBundle(log logger.Logger, traceDir string) []byte {
	// Keep in sync with glob pattern in service/pprof.go.
	pattern := filepath.Join(traceDir, "trace.*.out")
	matches, err := filepath.Glob(pattern)
	if err != nil {
		log.Warning("Error on filepath.Glob(%q): %s", pattern, err)
		return nil
	}

	if len(matches) > maxTraceFileCount {
		// Sort by approximate increasing time.
		sort.Strings(matches)
		matches = matches[len(matches)-maxTraceFileCount:]
	}

	buf := bytes.NewBuffer(nil)
	added := addFilesToTarGz(log, buf, matches)
	if !added {
		return nil
	}
	return buf.Bytes()
}

// LogSend sends the the tails of log files to kb, and also the last
// few trace output files.
func (l *LogSendContext) LogSend(statusJSON, feedback string, sendLogs bool, numBytes int) (string, error) {
	logs := l.Logs
	var kbfsLog string
	var svcLog string
	var desktopLog string
	var updaterLog string
	var startLog string
	var installLog string
	var systemLog string
	var gitLog string
	var traceBundle []byte

	if sendLogs {
		svcLog = tail(l.G().Log, "service", logs.Service, numBytes)
		kbfsLog = tail(l.G().Log, "kbfs", logs.Kbfs, numBytes)
		desktopLog = tail(l.G().Log, "desktop", logs.Desktop, numBytes)
		updaterLog = tail(l.G().Log, "updater", logs.Updater, numBytes)
		// We don't use the systemd journal to store regular logs, since on
		// some systems (e.g. Ubuntu 16.04) it's not persisted across boots.
		// However we do use it for startup logs, since that's the only place
		// to get them in systemd mode.
		if l.G().Env.WantsSystemd() {
			startLog = tailSystemdJournal(l.G().Log, []string{"keybase.service", "kbfs.service", "keybase.gui.service"}, numBytes)
		} else {
			startLog = tail(l.G().Log, "start", logs.Start, numBytes)
		}
		installLog = tail(l.G().Log, "install", logs.Install, numBytes)
		systemLog = tail(l.G().Log, "system", logs.System, numBytes)
		gitLog = tail(l.G().Log, "git", logs.Git, numBytes)
		if logs.Trace != "" {
			traceBundle = getTraceBundle(l.G().Log, logs.Trace)
		}
	} else {
		kbfsLog = ""
		svcLog = ""
		desktopLog = ""
		updaterLog = ""
		startLog = ""
		installLog = ""
		systemLog = ""
		gitLog = ""
	}

	return l.post(statusJSON, feedback, kbfsLog, svcLog, desktopLog, updaterLog, startLog, installLog, systemLog, gitLog, traceBundle)
}
