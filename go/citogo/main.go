package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/keybase/client/go/citogo/types"
)

type opts struct {
	Flakes               int
	Fails                int
	Prefix               string
	S3Bucket             string
	ReportLambdaFunction string
	DirBasename          string
	BuildID              string
	Branch               string
	Parallel             int
	Preserve             bool
	BuildURL             string
	NoCompile            bool
	TestBinary           string
	Timeout              string
	Pause                time.Duration
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
	flag.IntVar(&r.opts.Parallel, "parallel", 1, "number of tests to run in parallel")
	flag.StringVar(&r.opts.Prefix, "prefix", "", "test set prefix")
	flag.StringVar(&r.opts.S3Bucket, "s3bucket", "", "AWS S3 bucket to write failures to")
	flag.StringVar(&r.opts.ReportLambdaFunction, "report-lambda-function", "", "lambda function to report results to")
	flag.StringVar(&r.opts.BuildID, "build-id", "", "build ID of the current build")
	flag.StringVar(&r.opts.Branch, "branch", "", "the branch of the current build")
	flag.BoolVar(&r.opts.Preserve, "preserve", false, "preserve test binary after done")
	flag.StringVar(&r.opts.BuildURL, "build-url", "", "URL for this build (in CI mainly)")
	flag.BoolVar(&r.opts.NoCompile, "no-compile", false, "specify flag if you've pre-compiled the test")
	flag.StringVar(&r.opts.TestBinary, "test-binary", "", "specify the test binary to run")
	flag.StringVar(&r.opts.Timeout, "timeout", "60s", "timeout (in seconds) for any one individual test")
	flag.DurationVar(&r.opts.Pause, "pause", 0, "pause duration between each test (default 0)")
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
	tmpfile, err := os.CreateTemp("", fmt.Sprintf("%s-", logName))
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

func (r *runner) report(result types.TestResult) {
	if r.opts.ReportLambdaFunction == "" {
		return
	}

	b, err := json.Marshal(result)
	if err != nil {
		logError("error marshalling result: %s", err.Error())
		return
	}

	err = lambdaInvoke(r.opts.ReportLambdaFunction, b)
	if err != nil {
		logError("error reporting flake: %s", err.Error())
	}
}

func (r *runner) newTestResult(outcome types.Outcome, testName string, where string) types.TestResult {
	return types.TestResult{
		Outcome:  outcome,
		TestName: testName,
		Where:    where,
		Branch:   r.opts.Branch,
		BuildID:  r.opts.BuildID,
		Prefix:   r.opts.Prefix,
		BuildURL: r.opts.BuildURL,
	}
}

func (r *runner) runTest(test string) error {
	canRerun := len(r.flakes) < r.opts.Flakes
	outcome, where, err := r.runTestOnce(test, false /* isRerun */, canRerun)
	if err != nil {
		return err
	}
	if outcome == types.OutcomeSuccess {
		return nil
	}
	if len(r.flakes) >= r.opts.Flakes {
		return errTestFailed
	}
	outcome2, _, err2 := r.runTestOnce(test, true /* isRerun */, false /* canRerun */)
	if err2 != nil {
		return err2
	}
	switch outcome2 {
	case types.OutcomeFail:
		return errTestFailed
	case types.OutcomeSuccess:
		r.report(r.newTestResult(types.OutcomeFlake, test, where))
		r.flakes = append(r.flakes, test)
	}
	return nil
}

var errTestFailed = errors.New("test failed")

// runTestOnce only returns an error if there was a problem with the test
// harness code; it does not return an error if the test failed.
func (r *runner) runTestOnce(test string, isRerun bool, canRerun bool) (outcome types.Outcome, where string, err error) {
	defer func() {
		logOutcome := outcome
		if outcome == types.OutcomeFail && canRerun {
			logOutcome = types.OutcomeFlake
		}
		fmt.Printf("%s: %s %s\n", logOutcome.Abbrv(), test, where)
		if logOutcome != types.OutcomeFlake && r.opts.Branch == "master" && err == nil {
			r.report(r.newTestResult(logOutcome, test, where))
		}
	}()

	cmd := exec.Command(r.testerName(), "-test.run", "^"+test+"$", "-test.timeout", r.opts.Timeout)
	if isRerun {
		cmd.Env = append(os.Environ(), "CITOGO_FLAKE_RERUN=1")
	}
	var combined bytes.Buffer
	cmd.Stdout = &combined
	cmd.Stderr = &combined
	testErr := cmd.Run()
	if testErr != nil {
		err = errTestFailed

		var flushErr error
		where, flushErr := r.flushTestLogs(test, combined)
		if flushErr != nil {
			return types.OutcomeFail, "", flushErr
		}
		return types.OutcomeFail, where, nil
	}
	return types.OutcomeSuccess, "", nil
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
	var eg errgroup.Group
	q := make(chan string, len(r.tests))
	for i := 0; i < r.opts.Parallel; i++ {
		eg.Go(func() error {
			for f := range q {
				err := r.runTestFixError(f)
				if err != nil {
					return err
				}
				if r.opts.Pause > 0 {
					time.Sleep(r.opts.Pause)
				}
			}
			return nil
		})
	}
	for _, f := range r.tests {
		q <- f
	}
	close(q)
	return eg.Wait()
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
