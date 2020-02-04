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
	Preserve    bool
	BuildURL    string
	GetLogCmd   string
	NoCompile   bool
	TestBinary  string
}

func logError(f string, args ...interface{}) {
	s := fmt.Sprintf(f, args...)
	if s[len(s)-1] != '\n' {
		s += "\n"
	}
	fmt.Fprintf(os.Stderr, "%s", s)
}

func reportTestOutcome(outcome string, test string, where string) {
	fmt.Printf("%s: %s", outcome, test)
	if where != "" {
		fmt.Printf(" %s", where)
	}
	fmt.Printf("\n")
}

type runner struct {
	opts   opts
	flakes int
	fails  int
	tests  []string
}

func convertPrefix(p string) string {
	s := fmt.Sprintf("%c", os.PathSeparator)
	return strings.ReplaceAll(p, s, "_")
}

func (r *runner) parseArgs() (err error) {
	flag.IntVar(&r.opts.Flakes, "flakes", 3, "number of allowed flakes")
	flag.IntVar(&r.opts.Fails, "fails", -1, "number of fails allowed before quitting")
	var prfx string
	flag.StringVar(&prfx, "prefix", "", "test set prefix")
	flag.StringVar(&r.opts.S3Bucket, "s3bucket", "", "AWS S3 bucket to write failures to")
	flag.StringVar(&r.opts.BuildID, "build", "", "build ID of the current build")
	flag.BoolVar(&r.opts.Preserve, "preserve", false, "preserve test binary after done")
	flag.StringVar(&r.opts.BuildURL, "build-url", "", "URL for this build (in CI mainly)")
	flag.StringVar(&r.opts.GetLogCmd, "get-log-cmd", "", "Command to get logs from S3")
	flag.BoolVar(&r.opts.NoCompile, "no-compile", false, "specify flag if you've pre-compiled the test")
	flag.StringVar(&r.opts.TestBinary, "test-binary", "", "specify the test binary to run")
	flag.Parse()
	r.opts.Prefix = convertPrefix(prfx)
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
	buildID := strings.ReplaceAll(r.opts.BuildID, "-", "_")
	logName := fmt.Sprintf("citogo-%s-%s-%s", buildID, r.opts.Prefix, test)
	if r.opts.S3Bucket != "" {
		return r.flushLogsToS3(logName, log)
	}
	return r.flushTestLogsToTemp(logName, log)
}

func (r *runner) flushLogsToS3(logName string, log bytes.Buffer) (string, error) {
	return s3put(&log, r.opts.S3Bucket, logName, r.opts.GetLogCmd)
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
	hook += url.QueryEscape(fmt.Sprintf("❄️ _client_ %s %s *%s* %s [%s]", r.opts.BuildID, r.opts.Prefix, test, logs, r.opts.BuildURL))
	_, err := http.Get(hook)
	if err != nil {
		logError("error reporting flake: %s", err.Error())
	}
}

func (r *runner) runTest(test string) error {
	canRerun := r.flakes < r.opts.Flakes
	logs, err := r.runTestOnce(test, canRerun, false)
	if err == errTestFailed && canRerun {
		_, err = r.runTestOnce(test, false, true)
		if err == nil {
			r.reportFlake(test, logs)
			r.flakes++
		}
	}
	return err
}

var errTestFailed = errors.New("test failed")

func (r *runner) runTestOnce(test string, canRerun bool, isRerun bool) (string, error) {
	cmd := exec.Command(r.testerName(), "-test.run", "^"+test+"$")
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
	var status string
	if err != nil {
		var flushErr error
		where, flushErr = r.flushTestLogs(test, combined)
		if flushErr != nil {
			return "", flushErr
		}
		if canRerun {
			status = "FLK?"
		} else {
			status = "FAIL"
		}
	} else {
		status = "PASS"
	}
	reportTestOutcome(status, test, where)
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
	r.fails++
	if r.opts.Fails < 0 {
		// We have an infinite fail budget, so keep plowing through
		// failed tests. This test run is still going to fail.
		return nil
	}
	if r.opts.Fails >= r.fails {
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
	}
	return nil
}

func (r *runner) cleanup() {
	if r.opts.Preserve || r.opts.NoCompile {
		return
	}
	n := r.testerName()
	err := os.Remove(n)
	if err != nil {
		logError("could not remove %s: %s", n, err.Error())
	}
}

func (r *runner) debugStartup() {
	dir, _ := os.Getwd()
	fmt.Printf("WDIR: %s\n", dir)
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
	err = r.listTests()
	if err != nil {
		return err
	}
	err = r.runTests()
	r.cleanup()
	end := time.Now()
	diff := end.Sub(start)
	fmt.Printf("DONE: in %s\n", diff)
	if err != nil {
		return err
	}
	if r.fails > 0 {
		return fmt.Errorf("RED!: %d total tests failed", r.fails)
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
