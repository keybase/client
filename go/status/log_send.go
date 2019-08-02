// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package status

import (
	"bytes"
	"fmt"
	"mime/multipart"
	"os"
	"regexp"
	"strings"

	humanize "github.com/dustin/go-humanize"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

const (
	// After gzipping the logs we compress by this factor on avg. We use this
	// to calculate the amount of raw log bytes we should read when sending.
	AvgCompressionRatio        = 5
	LogSendDefaultBytesDesktop = 1024 * 1024 * 16
	// NOTE: On mobile we may store less than the number of bytes we attempt to
	// send. See go/libkb/env.go:Env.GetLogFileConfig
	LogSendDefaultBytesMobileWifi   = 1024 * 1024 * 10
	LogSendDefaultBytesMobileNoWifi = 1024 * 1024 * 1
	LogSendMaxBytes                 = 1024 * 1024 * 128
)

// Logs is the struct to specify the path of log files
type Logs struct {
	Desktop    string
	Kbfs       string
	Service    string
	EK         string
	Updater    string
	Start      string
	Install    string
	System     string
	Git        string
	Trace      string
	CPUProfile string
	Watchdog   string
	Processes  string
}

// LogSendContext for LogSend
type LogSendContext struct {
	libkb.Contextified

	InstallID  libkb.InstallID
	UID        keybase1.UID
	StatusJSON string
	Feedback   string

	Logs Logs

	kbfsLog          string
	svcLog           string
	ekLog            string
	desktopLog       string
	updaterLog       string
	startLog         string
	installLog       string
	systemLog        string
	gitLog           string
	traceBundle      []byte
	cpuProfileBundle []byte
	watchdogLog      string
	processesLog     string
}

var noncharacterRxx = regexp.MustCompile(`[^\w]`)

const redactedReplacer = "[REDACTED]"
const serialPaperKeyWordThreshold = 5

func redactPotentialPaperKeys(s string) string {
	doubleDelimited := noncharacterRxx.ReplaceAllFunc([]byte(s), func(x []byte) []byte {
		return []byte{'~', '~', '~', x[0], '~', '~', '~'} // regexp is single char so we can take first elem
	})
	allWords := strings.Split(string(doubleDelimited), "~~~")
	var checkWords []string
	var checkWordLocations []int // keep track of each checkWord's index in allWords
	for idx, word := range allWords {
		if !(len(word) == 1 && noncharacterRxx.MatchString(word)) {
			checkWords = append(checkWords, word)
			checkWordLocations = append(checkWordLocations, idx)
		}
	}
	didRedact := false
	start := -1
	for idx, word := range checkWords {
		if !libkb.ValidSecWord(word) {
			start = -1
			continue
		}
		switch {
		case start == -1:
			start = idx
		case idx-start+1 == serialPaperKeyWordThreshold:
			for jdx := start; jdx <= idx; jdx++ {
				allWords[checkWordLocations[jdx]] = redactedReplacer
			}
			didRedact = true
		case idx-start+1 > serialPaperKeyWordThreshold:
			allWords[checkWordLocations[idx]] = redactedReplacer
		}
	}
	if didRedact {
		return "[redacted feedback follows] " + strings.Join(allWords, "")
	}
	return s
}

func NewLogSendContext(g *libkb.GlobalContext, fstatus *keybase1.FullStatus, statusJSON, feedback string) *LogSendContext {
	logs := logFilesFromStatus(g, fstatus)

	var uid keybase1.UID
	if fstatus != nil && fstatus.CurStatus.User != nil {
		uid = fstatus.CurStatus.User.Uid
	} else {
		uid = g.Env.GetUID()
	}
	if uid.IsNil() {
		g.Log.Info("Not sending up a UID for logged in user; none found")
	}

	feedback = redactPotentialPaperKeys(feedback)

	return &LogSendContext{
		Contextified: libkb.NewContextified(g),
		UID:          uid,
		InstallID:    g.Env.GetInstallID(),
		StatusJSON:   statusJSON,
		Feedback:     feedback,
		Logs:         logs,
	}
}

func (l *LogSendContext) post(mctx libkb.MetaContext) (keybase1.LogSendID, error) {
	mctx.Debug("sending status + logs to keybase")

	var body bytes.Buffer
	mpart := multipart.NewWriter(&body)

	if l.Feedback != "" {
		err := mpart.WriteField("feedback", l.Feedback)
		if err != nil {
			return "", err
		}
	}

	if len(l.InstallID) > 0 {
		err := mpart.WriteField("install_id", string(l.InstallID))
		if err != nil {
			return "", err
		}
	}

	if !l.UID.IsNil() {
		err := mpart.WriteField("uid", l.UID.String())
		if err != nil {
			return "", err
		}
	}

	if err := addGzippedFile(mpart, "status_gz", "status.gz", l.StatusJSON); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "kbfs_log_gz", "kbfs_log.gz", l.kbfsLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "keybase_log_gz", "keybase_log.gz", l.svcLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "ek_log_gz", "ek_log.gz", l.ekLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "updater_log_gz", "updater_log.gz", l.updaterLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "gui_log_gz", "gui_log.gz", l.desktopLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "start_log_gz", "start_log.gz", l.startLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "install_log_gz", "install_log.gz", l.installLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "system_log_gz", "system_log.gz", l.systemLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "git_log_gz", "git_log.gz", l.gitLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "watchdog_log_gz", "watchdog_log.gz", l.watchdogLog); err != nil {
		return "", err
	}
	if err := addGzippedFile(mpart, "processes_log_gz", "processes_log.gz", l.processesLog); err != nil {
		return "", err
	}

	if len(l.traceBundle) > 0 {
		mctx.Debug("trace bundle size: %d", len(l.traceBundle))
		if err := addFile(mpart, "trace_tar_gz", "trace.tar.gz", l.traceBundle); err != nil {
			return "", err
		}
	}

	if len(l.cpuProfileBundle) > 0 {
		mctx.Debug("CPU profile bundle size: %d", len(l.cpuProfileBundle))
		if err := addFile(mpart, "cpu_profile_tar_gz", "cpu_profile.tar.gz", l.cpuProfileBundle); err != nil {
			return "", err
		}
	}

	if err := mpart.Close(); err != nil {
		return "", err
	}

	mctx.Debug("body size: %d", body.Len())

	arg := libkb.APIArg{
		Endpoint:    "logdump/send",
		SessionType: libkb.APISessionTypeOPTIONAL,
	}

	resp, err := mctx.G().API.PostRaw(mctx, arg, mpart.FormDataContentType(), &body)
	if err != nil {
		mctx.Debug("post error: %s", err)
		return "", err
	}

	id, err := resp.Body.AtKey("logdump_id").GetString()
	if err != nil {
		return "", err
	}

	return keybase1.LogSendID(id), nil
}

// LogSend sends the tails of log files to kb, and also the last few trace
// output files.
func (l *LogSendContext) LogSend(sendLogs bool, numBytes int, mergeExtendedStatus bool) (id keybase1.LogSendID, err error) {
	if numBytes < 1 {
		numBytes = LogSendDefaultBytesDesktop
	} else if numBytes > LogSendMaxBytes {
		numBytes = LogSendMaxBytes
	}
	mctx := libkb.NewMetaContextBackground(l.G()).WithLogTag("LOGSEND")
	defer mctx.TraceTimed(fmt.Sprintf("LogSend sendLogs: %v numBytes: %s",
		sendLogs, humanize.Bytes(uint64(numBytes))), func() error { return err })()

	logs := l.Logs
	// So far, install logs are Windows only
	if logs.Install != "" {
		defer os.Remove(logs.Install)
	}
	// So far, watchdog logs are Windows only
	if logs.Watchdog != "" {
		defer os.Remove(logs.Watchdog)
	}

	if sendLogs {
		// Increase some log files by the average compression ratio size
		// so we have more comprehensive coverage there.
		l.svcLog = tail(l.G().Log, "service", logs.Service, numBytes*AvgCompressionRatio)
		l.ekLog = tail(l.G().Log, "ek", logs.EK, numBytes)
		l.kbfsLog = tail(l.G().Log, "kbfs", logs.Kbfs, numBytes*AvgCompressionRatio)
		l.desktopLog = tail(l.G().Log, "desktop", logs.Desktop, numBytes)
		l.updaterLog = tail(l.G().Log, "updater", logs.Updater, numBytes)
		// We don't use the systemd journal to store regular logs, since on
		// some systems (e.g. Ubuntu 16.04) it's not persisted across boots.
		// However we do use it for startup logs, since that's the only place
		// to get them in systemd mode.
		if l.G().Env.WantsSystemd() {
			l.startLog = tailSystemdJournal(l.G().Log, []string{
				"keybase.service",
				"kbfs.service",
				"keybase.gui.service",
				"keybase-redirector.service",
			}, numBytes)
		} else {
			l.startLog = tail(l.G().Log, "start", logs.Start, numBytes)
		}
		l.installLog = tail(l.G().Log, "install", logs.Install, numBytes)
		l.systemLog = tail(l.G().Log, "system", logs.System, numBytes)
		l.gitLog = tail(l.G().Log, "git", logs.Git, numBytes)
		l.watchdogLog = tail(l.G().Log, "watchdog", logs.Watchdog, numBytes)
		if logs.Trace != "" {
			l.traceBundle = getTraceBundle(l.G().Log, logs.Trace)
		}
		if logs.CPUProfile != "" {
			l.cpuProfileBundle = getCPUProfileBundle(l.G().Log, logs.CPUProfile)
		}
		// Only add extended status if we're sending logs
		if mergeExtendedStatus {
			l.StatusJSON = l.mergeExtendedStatus(l.StatusJSON)
		}
		l.processesLog = keybaseProcessList()
	}

	return l.post(mctx)
}

// mergeExtendedStatus adds the extended status to the given status json blob.
// If any errors occur the original status is returned unmodified.
func (l *LogSendContext) mergeExtendedStatus(status string) string {
	extStatus, err := GetExtendedStatus(libkb.NewMetaContextTODO(l.G()))
	if err != nil {
		return status
	}
	return MergeStatusJSON(extStatus, "extstatus", status)
}

// Clear removes any log data that we don't want to stick around until the
// next time LogSend is called, in case sendLogs is false the next time.
func (l *LogSendContext) Clear() {
	l.svcLog = ""
	l.ekLog = ""
	l.kbfsLog = ""
	l.desktopLog = ""
	l.updaterLog = ""
	l.startLog = ""
	l.installLog = ""
	l.systemLog = ""
	l.gitLog = ""
	l.watchdogLog = ""
	l.traceBundle = []byte{}
	l.cpuProfileBundle = []byte{}
	l.processesLog = ""
}
