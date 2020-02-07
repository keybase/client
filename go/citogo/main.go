package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type opts struct {
	Flakes      int
	Fails       int
	Prefix      string
	S3Bucket    string
	DirBasename string
	BuildID     string
	Branch      string
	Preserve    bool
	BuildURL    string
	NoCompile   bool
	TestBinary  string
	Timeout     string
	Pause       int
}

func logError(f string, args ...interface{}) {
	s := fmt.Sprintf(f, args...)
	if s[len(s)-1] != '\n' {
		s += "\n"
	}
	fmt.Fprintf(os.Stderr, "%s", s)
}

type runner struct {
	opts   opts
	flakes []string
	fails  []string
	tests  []string
}

func convertBreakingChars(s string) string {
	// replace either the unix or the DOS directory marker
	// with an underscore, so as not to break the directory
	// structure of where we are storing the log
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, "\\", "_")
	s = strings.ReplaceAll(s, "-", "_")
	return s
}

func (r *runner) parseArgs() (err error) {
	flag.IntVar(&r.opts.Flakes, "flakes", 3, "number of allowed flakes")
	flag.IntVar(&r.opts.Fails, "fails", -1, "number of fails allowed before quitting")
	flag.StringVar(&r.opts.Prefix, "prefix", "", "test set prefix")
	flag.StringVar(&r.opts.S3Bucket, "s3bucket", "", "AWS S3 bucket to write failures to")
	flag.StringVar(&r.opts.BuildID, "build-id", "", "build ID of the current build")
	flag.StringVar(&r.opts.Branch, "branch", "", "the branch of the current build")
	flag.BoolVar(&r.opts.Preserve, "preserve", false, "preserve test binary after done")
	flag.StringVar(&r.opts.BuildURL, "build-url", "", "URL for this build (in CI mainly)")
	flag.BoolVar(&r.opts.NoCompile, "no-compile", false, "specify flag if you've pre-compiled the test")
	flag.StringVar(&r.opts.TestBinary, "test-binary", "", "specify the test binary to run")
	flag.StringVar(&r.opts.Timeout, "timeout", "60s", "timeout (in seconds) for any one individual test")
	flag.IntVar(&r.opts.Pause, "pause", 0, "pause that many seconds between each test")
	flag.Parse()
	var d string
	d, err = os.Getwd()
	if err != nil {
		return err
	}
	r.opts.DirBasename = filepath.Base(d)
	return nil
}

func (r *runner) compile() error {
	if r.opts.NoCompile {
		return nil
	}
	fmt.Printf("CMPL: %s\n", r.testerName())
	cmd := exec.Command("go", "test", "-c")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func filter(v []string) []string {
	var ret []string
	for _, s := range v {
		if s != "" {
			ret = append(ret, s)
		}
	}
	return ret
}

func (r *runner) testerName() string {
	if r.opts.TestBinary != "" {
		return r.opts.TestBinary
	}
	return fmt.Sprintf(".%c%s.test", os.PathSeparator, r.opts.DirBasename)
}

func (r *runner) listTests() error {
	cmd := exec.Command(r.testerName(), "-test.list", ".")
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return err
	}
	r.tests = filter(strings.Split(out.String(), "\n"))
	return nil
}

func (r *runner) flushTestLogs(test string, log bytes.Buffer) (string, error) {
	logName := fmt.Sprintf("citogo-%s-%s-%s-%s", convertBreakingChars(r.opts.Branch),
		convertBreakingChars(r.opts.BuildID), convertBreakingChars(r.opts.Prefix), test)
	if r.opts.S3Bucket != "" {
		return r.flushLogsToS3(logName, log)
	}
	return r.flushTestLogsToTemp(logName, log)
}

func (r *runner) flushLogsToS3(logName string, log bytes.Buffer) (string, error) {
	return s3put(&log, r.opts.S3Bucket, logName)
}

func (r *runner) flushTestLogsToTemp(logName string, log bytes.Buffer) (string, error) {
	tmpfile, err := ioutil.TempFile("", fmt.Sprintf("%s-", logName))
	if err != nil {
		return "", err
	}
	_, err = tmpfile.Write(log.Bytes())
	if err != nil {
		return "", err
	}
	err = tmpfile.Close()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("see log: %s", tmpfile.Name()), nil
}

func (r *runner) reportFlake(test string, logs string) {
	hook := os.Getenv("CITOGO_FLAKE_WEBHOOK")
	if hook == "" {
		return
	}

	r.doHook(hook, test, logs, "❄️")
}

func (r *runner) doHook(hook string, test string, logs string, emoji string) {
	hook += url.QueryEscape(fmt.Sprintf("%s _client_ %s-%s %s *%s* %s [%s]", emoji, r.opts.Branch, r.opts.BuildID, r.opts.Prefix, test, logs, r.opts.BuildURL))
	_, err := http.Get(hook)
	if err != nil {
		logError("error reporting flake: %s", err.Error())
	}
}

type outcome string

const (
	success outcome = "success"
	flake   outcome = "flake"
	fail    outcome = "fail"
)

func (o outcome) abbrv() string {
	switch o {
	case success:
		return "PASS"
	case flake:
		return "FLK?"
	case fail:
		return "FAIL"
	default:
		return "????"
	}
}

func (r *runner) reportTestOutcome(outcome outcome, test string, where string) {
	fmt.Printf("%s: %s", outcome.abbrv(), test)
	if where != "" {
		fmt.Printf(" %s", where)
	}
	fmt.Printf("\n")

	if outcome != fail || r.opts.Branch != "master" {
		return
	}
	hook := os.Getenv("CITOGO_MASTER_FAIL_WEBHOOK")
	if hook == "" {
		return
	}
	r.doHook(hook, test, where, "🥴")
}

func (r *runner) runTest(test string) error {
	canRerun := len(r.flakes) < r.opts.Flakes
	logs, err := r.runTestOnce(test, canRerun, false)
	if err == errTestFailed && canRerun {
		_, err = r.runTestOnce(test, false, true)
		if err == nil {
			r.reportFlake(test, logs)
			r.flakes = append(r.flakes, test)
		}
	}
	return err
}

var errTestFailed = errors.New("test failed")

func (r *runner) runTestOnce(test string, canRerun bool, isRerun bool) (string, error) {
	cmd := exec.Command(r.testerName(), "-test.run", "^"+test+"$", "-test.timeout", r.opts.Timeout)
	var combined bytes.Buffer
	if isRerun {
		cmd.Env = append(os.Environ(), "CITOGO_FLAKE_RERUN=1")
	}
	cmd.Stdout = &combined
	cmd.Stderr = &combined
	err := cmd.Run()
	if err != nil {
		err = errTestFailed
	}
	var where string
	var status outcome
	if err != nil {
		var flushErr error
		where, flushErr = r.flushTestLogs(test, combined)
		if flushErr != nil {
			return "", flushErr
		}
		if canRerun {
			status = flake
		} else {
			status = fail
		}
	} else {
		status = success
	}
	r.reportTestOutcome(status, test, where)
	return where, err
}

func (r *runner) runTestFixError(t string) error {
	err := r.runTest(t)
	if err == nil {
		return nil
	}
	if err != errTestFailed {
		return err
	}
	r.fails = append(r.fails, t)
	if r.opts.Fails < 0 {
		// We have an infinite fail budget, so keep plowing through
		// failed tests. This test run is still going to fail.
		return nil
	}
	if r.opts.Fails >= len(r.fails) {
		// We've failed less than our budget, so we can still keep going.
		// This test run is still going to fail.
		return nil
	}
	// We ate up our fail budget.
	return err
}

func (r *runner) runTests() error {
	for _, f := range r.tests {
		err := r.runTestFixError(f)
		if err != nil {
			return err
		}
		if r.opts.Pause > 0 {
			fmt.Printf("PAUS: %ds\n", r.opts.Pause)
			time.Sleep(time.Duration(r.opts.Pause) * time.Second)
		}
	}
	return nil
}

func (r *runner) cleanup() {
	if r.opts.Preserve || r.opts.NoCompile {
		return
	}
	n := r.testerName()
	err := os.Remove(n)
	fmt.Printf("RMOV: %s\n", n)
	if err != nil {
		logError("could not remove %s: %s", n, err.Error())
	}
}

func (r *runner) debugStartup() {
	dir, _ := os.Getwd()
	fmt.Printf("WDIR: %s\n", dir)
}

func (r *runner) testExists() (bool, error) {
	f := r.testerName()
	info, err := os.Stat(f)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if info.Mode().IsRegular() {
		return true, nil
	}
	return false, fmt.Errorf("%s: file of wrong type", f)

}

func (r *runner) run() error {
	start := time.Now()
	err := r.parseArgs()
	if err != nil {
		return err
	}
	r.debugStartup()
	err = r.compile()
	if err != nil {
		return err
	}
	exists, err := r.testExists()
	if exists {
		err = r.listTests()
		if err != nil {
			return err
		}
		err = r.runTests()
		r.cleanup()
	}
	end := time.Now()
	diff := end.Sub(start)
	fmt.Printf("DONE: in %s\n", diff)
	if err != nil {
		return err
	}
	if len(r.fails) > 0 {
		// If we have more than 15 tests, repeat at the end which tests failed,
		// so we don't have to scroll all the way up.
		if len(r.tests) > 15 {
			for _, t := range r.fails {
				fmt.Printf("FAIL: %s\n", t)
			}
		}
		return fmt.Errorf("RED!: %d total tests failed", len(r.fails))
	}
	return nil
}

func main2() error {
	runner := runner{}
	return runner.run()
}

func main() {
	err := main2()
	if err != nil {
		logError(err.Error())
		fmt.Printf("EXIT: 2\n")
		os.Exit(2)
	}
	fmt.Printf("EXIT: 0\n")
	os.Exit(0)
}
