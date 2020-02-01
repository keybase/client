package main

import (
	"bytes"
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path"
	"strings"
)

type opts struct {
	Flakes      int
	Prefix      string
	S3Bucket    string
	DirBasename string
}

func logError(f string, args ...interface{}) {
	s := fmt.Sprintf(f, args...)
	if s[len(s)-1] != '\n' {
		s = s + "\n"
	}
	fmt.Fprintf(os.Stderr, "%s", s)
}

func report(outcome string, test string, where string) {
	fmt.Printf("%s: %s", outcome, test)
	if where != "" {
		fmt.Printf(" %s", where)
	}
	fmt.Printf("\n")
}

type runner struct {
	opts   opts
	flakes int
	tests  []string
}

func (r *runner) parseArgs() (err error) {
	flag.IntVar(&r.opts.Flakes, "flakes", 3, "number of allowed flakes")
	flag.StringVar(&r.opts.Prefix, "prefix", "", "test set prefix")
	flag.StringVar(&r.opts.S3Bucket, "s3bucket", "", "AWS S3 bucket to write failures to")
	flag.Parse()
	var d string
	d, err = os.Getwd()
	if err != nil {
		return err
	}
	r.opts.DirBasename = path.Base(d)
	return nil
}

func (r *runner) compile() error {
	return exec.Command("go", "test", "-c").Run()
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
	return "./" + r.opts.DirBasename + ".test"
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

func (r *runner) flush(test string, log bytes.Buffer) (string, error) {
	tmpfile, err := ioutil.TempFile("", fmt.Sprintf("citogo-%s-%s-", r.opts.Prefix, test))
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

func (r *runner) runTest(test string) error {
	canRerun := r.flakes < r.opts.Flakes
	err := r.runTestOnce(test, canRerun)
	if err != nil && canRerun {
		r.flakes++
		err = r.runTestOnce(test, false)
	}
	return err
}

func (r *runner) runTestOnce(test string, canRerun bool) error {
	cmd := exec.Command(r.testerName(), "-test.run", "^"+test+"$")
	var combined bytes.Buffer
	cmd.Stdout = &combined
	cmd.Stderr = &combined
	err := cmd.Run()
	var where string
	var status string
	if err != nil {
		var flushErr error
		where, flushErr = r.flush(test, combined)
		if flushErr != nil {
			return flushErr
		}
		if canRerun {
			status = "FLK?"
		} else {
			status = "FAIL"
		}
	} else {
		status = "PASS"
	}
	report(status, test, where)
	return err
}

func (r *runner) runTests() error {
	for _, f := range r.tests {
		err := r.runTest(f)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *runner) run() error {
	err := r.compile()
	if err != nil {
		return err
	}
	err = r.listTests()
	if err != nil {
		return err
	}
	err = r.runTests()
	if err != nil {
		return err
	}
	fmt.Printf("%+v\n", *r)
	return nil
}

func main2() error {
	runner := runner{}
	err := runner.parseArgs()
	if err != nil {
		return err
	}
	return runner.run()
}

func main() {
	err := main2()
	if err != nil {
		logError(err.Error())
		os.Exit(2)
	}
	os.Exit(0)
}
