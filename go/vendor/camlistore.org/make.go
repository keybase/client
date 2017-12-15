// +build ignore

/*
Copyright 2013 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// This program builds Camlistore.
//
// $ go run make.go
//
// See the BUILDING file.
//
// The output binaries go into the ./bin/ directory (under the
// Camlistore root, where make.go is)
package main

import (
	"archive/zip"
	"bufio"
	"bytes"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	pathpkg "path"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"
)

var haveSQLite = checkHaveSQLite()

var (
	embedResources = flag.Bool("embed_static", true, "Whether to embed resources needed by the UI such as images, css, and javascript.")
	sqlFlag        = flag.String("sqlite", "false", "Whether you want SQLite in your build: true, false, or auto.")
	all            = flag.Bool("all", false, "Force rebuild of everything (go install -a)")
	race           = flag.Bool("race", false, "Build race-detector version of binaries (they will run slowly)")
	verbose        = flag.Bool("v", strings.Contains(os.Getenv("CAMLI_DEBUG_X"), "makego"), "Verbose mode")
	targets        = flag.String("targets", "", "Optional comma-separated list of targets (i.e go packages) to build and install. '*' builds everything.  Empty builds defaults for this platform. Example: camlistore.org/server/camlistored,camlistore.org/cmd/camput")
	quiet          = flag.Bool("quiet", false, "Don't print anything unless there's a failure.")
	onlysync       = flag.Bool("onlysync", false, "Only populate the temporary source/build tree and output its full path. It is meant to prepare the environment for running the full test suite with 'devcam test'.")
	useGoPath      = flag.Bool("use_gopath", false, "Use GOPATH from the environment and work from there. Do not create a temporary source tree with a new GOPATH in it.")
	ifModsSince    = flag.Int64("if_mods_since", 0, "If non-zero return immediately without building if there aren't any filesystem modifications past this time (in unix seconds)")
	buildARCH      = flag.String("arch", runtime.GOARCH, "Architecture to build for.")
	buildOS        = flag.String("os", runtime.GOOS, "Operating system to build for.")
	stampVersion   = flag.Bool("stampversion", true, "Stamp version into buildinfo.GitInfo")
)

var (
	// camRoot is the original Camlistore project root, from where the source files are mirrored.
	camRoot string
	// buildGoPath becomes our child "go" processes' GOPATH environment variable
	buildGoPath string
	// Our temporary source tree root and build dir, i.e: buildGoPath + "src/camlistore.org"
	buildSrcDir string
	// files mirrored from camRoot to buildSrcDir
	rxMirrored = regexp.MustCompile(`^([a-zA-Z0-9\-\_]+\.(?:blobs|camli|css|eot|err|gif|go|pb\.go|gpg|html|ico|jpg|js|json|xml|min\.css|min\.js|mp3|otf|png|svg|pdf|psd|tiff|ttf|woff|xcf|tar\.gz|gz|tar\.xz|tbz2|zip))$`)
)

func main() {
	log.SetFlags(0)
	flag.Parse()

	if *buildARCH == "386" && *buildOS == "darwin" {
		if ok, _ := strconv.ParseBool(os.Getenv("CAMLI_FORCE_OSARCH")); !ok {
			log.Fatalf("You're trying to build a 32-bit binary for a Mac. That is almost always a mistake.\nTo do it anyway, set env CAMLI_FORCE_OSARCH=1 and run again.\n")
		}
	}

	verifyGoVersion()

	sql := withSQLite()
	if useEnvGoPath, _ := strconv.ParseBool(os.Getenv("CAMLI_MAKE_USEGOPATH")); useEnvGoPath {
		*useGoPath = true
	}
	latestSrcMod := time.Now()
	if *useGoPath {
		buildGoPath = os.Getenv("GOPATH")
		var err error
		camRoot, err = goPackagePath("camlistore.org")
		if err != nil {
			log.Fatalf("Cannot run make.go with --use_gopath: %v (is GOPATH not set?)", err)
		}
		buildSrcDir = camRoot
		if *ifModsSince > 0 {
			latestSrcMod = walkDirs(sql)
		}
	} else {
		var err error
		camRoot, err = os.Getwd()
		if err != nil {
			log.Fatalf("Failed to get current directory: %v", err)
		}
		latestSrcMod = mirror(sql)
		if *onlysync {
			mirrorFile("make.go", filepath.Join(buildSrcDir, "make.go"))
			deleteUnwantedOldMirrorFiles(buildSrcDir, true)
			fmt.Println(buildGoPath)
			return
		}
	}
	if latestSrcMod.Before(time.Unix(*ifModsSince, 0)) {
		return
	}
	binDir := filepath.Join(camRoot, "bin")
	version := getVersion()

	if *verbose {
		log.Printf("Camlistore version = %s", version)
		log.Printf("SQLite included: %v", sql)
		log.Printf("Temporary source: %s", buildSrcDir)
		log.Printf("Output binaries: %s", binDir)
	}

	buildAll := false
	targs := []string{
		"camlistore.org/dev/devcam",
		"camlistore.org/cmd/camget",
		"camlistore.org/cmd/camput",
		"camlistore.org/cmd/camtool",
		"camlistore.org/cmd/camdeploy",
		"camlistore.org/server/camlistored",
		"camlistore.org/app/hello",
		"camlistore.org/app/publisher",
	}
	switch *targets {
	case "*":
		buildAll = true
	case "":
		// Add cammount to default build targets on OSes that support FUSE.
		switch *buildOS {
		case "linux", "darwin":
			targs = append(targs, "camlistore.org/cmd/cammount")
		}
	default:
		if t := strings.Split(*targets, ","); len(t) != 0 {
			targs = t
		}
	}

	withCamlistored := stringListContains(targs, "camlistore.org/server/camlistored")
	if *embedResources && withCamlistored {
		// TODO(mpl): it looks like we always regenerate the
		// zembed.*.go, at least for the integration
		// tests. I'll look into it.
		doEmbed()
	}

	if !*useGoPath {
		deleteUnwantedOldMirrorFiles(buildSrcDir, withCamlistored)
	}

	tags := []string{"purego"} // for cznic/zappy
	if sql {
		tags = append(tags, "with_sqlite")
	}
	baseArgs := []string{"install", "-v"}
	if *all {
		baseArgs = append(baseArgs, "-a")
	}
	if *race {
		baseArgs = append(baseArgs, "-race")
	}
	if *verbose {
		log.Printf("version to stamp is %q", version)
	}
	var ldFlags string
	if *stampVersion {
		ldFlags = "-X camlistore.org/pkg/buildinfo.GitInfo=" + version
	}
	baseArgs = append(baseArgs, "--ldflags="+ldFlags, "--tags="+strings.Join(tags, " "))

	// First install command: build just the final binaries, installed to a GOBIN
	// under <camlistore_root>/bin:
	args := append(baseArgs, targs...)

	if buildAll {
		args = append(args,
			"camlistore.org/app/...",
			"camlistore.org/pkg/...",
			"camlistore.org/server/...",
			"camlistore.org/third_party/...",
			"camlistore.org/internal/...",
		)
	}

	cmd := exec.Command("go", args...)
	cmd.Env = append(cleanGoEnv(),
		"GOPATH="+buildGoPath,
		"GO15VENDOREXPERIMENT=1",
	)

	if *verbose {
		log.Printf("Running go %q with Env %q", args, cmd.Env)
	}

	var output bytes.Buffer
	if *quiet {
		cmd.Stdout = &output
		cmd.Stderr = &output
	} else {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	if *verbose {
		log.Printf("Running go install of main binaries with args %s", cmd.Args)
	}
	if err := cmd.Run(); err != nil {
		log.Fatalf("Error building main binaries: %v\n%s", err, output.String())
	}

	// Copy the binaries from $CAMROOT/tmp/build-gopath-foo/bin to $CAMROOT/bin.
	// This is necessary (instead of just using GOBIN environment variable) so
	// each tmp/build-gopath-* has its own binary modtimes for its own build tags.
	// Otherwise switching sqlite true<->false doesn't necessarily cause a rebuild.
	// See camlistore.org/issue/229
	for _, targ := range targs {
		src := exeName(filepath.Join(actualBinDir(filepath.Join(buildGoPath, "bin")), pathpkg.Base(targ)))
		dst := exeName(filepath.Join(actualBinDir(binDir), pathpkg.Base(targ)))
		if err := mirrorFile(src, dst); err != nil {
			log.Fatalf("Error copying %s to %s: %v", src, dst, err)
		}
	}

	if !*quiet {
		log.Printf("Success. Binaries are in %s", actualBinDir(binDir))
	}
}

// create the tmp GOPATH, and mirror to it from camRoot.
// return the latest modtime among all of the walked files.
func mirror(sql bool) (latestSrcMod time.Time) {
	verifyCamlistoreRoot(camRoot)

	buildBaseDir := "build-gopath"
	if !sql {
		buildBaseDir += "-nosqlite"
	}

	buildGoPath = filepath.Join(camRoot, "tmp", buildBaseDir)
	buildSrcDir = filepath.Join(buildGoPath, "src", "camlistore.org")

	if err := os.MkdirAll(buildSrcDir, 0755); err != nil {
		log.Fatal(err)
	}

	// We copy all *.go files from camRoot's goDirs to buildSrcDir.
	goDirs := []string{
		"app",
		"cmd",
		"depcheck",
		"dev",
		"internal",
		"pkg",
		"server/camlistored",
		"third_party",
		"vendor",
	}
	if *onlysync {
		goDirs = append(goDirs, "server/appengine", "config", "misc", "./website")
	}
	// Copy files we do want in our mirrored GOPATH.  This has the side effect of
	// populating wantDestFile, populated by mirrorFile.
	for _, dir := range goDirs {
		srcPath := filepath.Join(camRoot, filepath.FromSlash(dir))
		dstPath := buildSrcPath(dir)
		if maxMod, err := mirrorDir(srcPath, dstPath, walkOpts{sqlite: sql}); err != nil {
			log.Fatalf("Error while mirroring %s to %s: %v", srcPath, dstPath, err)
		} else {
			if maxMod.After(latestSrcMod) {
				latestSrcMod = maxMod
			}
		}
	}
	return
}

// TODO(mpl): see if walkDirs and mirror can be refactored further.

// walk all the dirs in camRoot, to return the latest
// modtime among all of the walked files.
func walkDirs(sql bool) (latestSrcMod time.Time) {
	d, err := os.Open(camRoot)
	if err != nil {
		log.Fatal(err)
	}
	dirs, err := d.Readdirnames(-1)
	d.Close()
	if err != nil {
		log.Fatal(err)
	}

	for _, dir := range dirs {
		srcPath := filepath.Join(camRoot, filepath.FromSlash(dir))
		if maxMod, err := walkDir(srcPath, walkOpts{sqlite: sql}); err != nil {
			log.Fatalf("Error while walking %s: %v", srcPath, err)
		} else {
			if maxMod.After(latestSrcMod) {
				latestSrcMod = maxMod
			}
		}
	}
	return
}

func actualBinDir(dir string) string {
	if *buildARCH == runtime.GOARCH && *buildOS == runtime.GOOS {
		return dir
	}
	return filepath.Join(dir, *buildOS+"_"+*buildARCH)
}

// Create an environment variable of the form key=value.
func envPair(key, value string) string {
	return fmt.Sprintf("%s=%s", key, value)
}

// cleanGoEnv returns a copy of the current environment with GOPATH and GOBIN removed.
// it also sets GOOS and GOARCH as needed when cross-compiling.
func cleanGoEnv() (clean []string) {
	for _, env := range os.Environ() {
		if strings.HasPrefix(env, "GOPATH=") || strings.HasPrefix(env, "GOBIN=") {
			continue
		}
		// We skip these two as well, otherwise they'd take precedence over the
		// ones appended below.
		if *buildOS != runtime.GOOS && strings.HasPrefix(env, "GOOS=") {
			continue
		}
		if *buildARCH != runtime.GOARCH && strings.HasPrefix(env, "GOARCH=") {
			continue
		}
		clean = append(clean, env)
	}
	if *buildOS != runtime.GOOS {
		clean = append(clean, envPair("GOOS", *buildOS))
	}
	if *buildARCH != runtime.GOARCH {
		clean = append(clean, envPair("GOARCH", *buildARCH))
	}
	return
}

// setEnv sets the given key & value in the provided environment.
// Each value in the env list should be of the form key=value.
func setEnv(env []string, key, value string) []string {
	for i, s := range env {
		if strings.HasPrefix(s, fmt.Sprintf("%s=", key)) {
			env[i] = envPair(key, value)
			return env
		}
	}
	env = append(env, envPair(key, value))
	return env
}

func stringListContains(strs []string, str string) bool {
	for _, s := range strs {
		if s == str {
			return true
		}
	}
	return false
}

// buildSrcPath returns the full path concatenation
// of buildSrcDir with fromSrc.
func buildSrcPath(fromSrc string) string {
	return filepath.Join(buildSrcDir, filepath.FromSlash(fromSrc))
}

// genEmbeds generates from the static resources the zembed.*.go
// files that will allow for these resources to be included in
// the camlistored binary.
// It also populates wantDestFile with those files so they're
// kept in between runs.
func genEmbeds() error {
	// Note: do not use exeName for genfileembed, as it will run on the current platform,
	// not on the one we're cross-compiling for.
	cmdName := filepath.Join(buildGoPath, "bin", "genfileembed")
	if runtime.GOOS == "windows" {
		cmdName += ".exe"
	}
	for _, embeds := range []string{"server/camlistored/ui", "pkg/server", "third_party/react", "third_party/less", "third_party/glitch", "third_party/fontawesome", "app/publisher"} {
		embeds := buildSrcPath(embeds)
		args := []string{"--output-files-stderr", embeds}
		cmd := exec.Command(cmdName, args...)
		cmd.Env = append(cleanGoEnv(),
			"GOPATH="+buildGoPath,
		)
		cmd.Stdout = os.Stdout
		stderr, err := cmd.StderrPipe()
		if err != nil {
			log.Fatal(err)
		}
		if *verbose {
			log.Printf("Running %s %s", cmdName, embeds)
		}
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("Error starting %s %s: %v", cmdName, embeds, err)
		}
		parseGenEmbedOutputLines(stderr)
		if err := cmd.Wait(); err != nil {
			return fmt.Errorf("Error running %s %s: %v", cmdName, embeds, err)
		}
	}
	return nil
}

func parseGenEmbedOutputLines(r io.Reader) {
	sc := bufio.NewScanner(r)
	for sc.Scan() {
		ln := sc.Text()
		if !strings.HasPrefix(ln, "OUTPUT:") {
			continue
		}
		wantDestFile[strings.TrimSpace(strings.TrimPrefix(ln, "OUTPUT:"))] = true
	}
}

func buildGenfileembed() error {
	args := []string{"install", "-v"}
	if *all {
		args = append(args, "-a")
	}
	args = append(args,
		filepath.FromSlash("camlistore.org/pkg/fileembed/genfileembed"),
	)
	cmd := exec.Command("go", args...)

	// We don't even need to set GOBIN as it defaults to $GOPATH/bin
	// and that is where we want genfileembed to go.
	// Here we replace the GOOS and GOARCH valuesfrom the env with the host OS,
	// to support cross-compiling.
	cmd.Env = cleanGoEnv()
	cmd.Env = setEnv(cmd.Env, "GOPATH", buildGoPath)
	cmd.Env = setEnv(cmd.Env, "GOOS", runtime.GOOS)
	cmd.Env = setEnv(cmd.Env, "GOARCH", runtime.GOARCH)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if *verbose {
		log.Printf("Running go with args %s", args)
	}
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("Error building genfileembed: %v", err)
	}
	if *verbose {
		log.Printf("genfileembed installed in %s", filepath.Join(buildGoPath, "bin"))
	}
	return nil
}

// getVersion returns the version of Camlistore. Either from a VERSION file at the root,
// or from git.
func getVersion() string {
	slurp, err := ioutil.ReadFile(filepath.Join(camRoot, "VERSION"))
	if err == nil {
		return strings.TrimSpace(string(slurp))
	}
	return gitVersion()
}

var gitVersionRx = regexp.MustCompile(`\b\d\d\d\d-\d\d-\d\d-[0-9a-f]{7,7}\b`)

// gitVersion returns the git version of the git repo at camRoot as a
// string of the form "yyyy-mm-dd-xxxxxxx", with an optional trailing
// '+' if there are any local uncomitted modifications to the tree.
func gitVersion() string {
	cmd := exec.Command("git", "rev-list", "--max-count=1", "--pretty=format:'%ad-%h'", "--date=short", "HEAD")
	cmd.Dir = camRoot
	out, err := cmd.Output()
	if err != nil {
		log.Fatalf("Error running git rev-list in %s: %v", camRoot, err)
	}
	v := strings.TrimSpace(string(out))
	if m := gitVersionRx.FindStringSubmatch(v); m != nil {
		v = m[0]
	} else {
		panic("Failed to find git version in " + v)
	}
	cmd = exec.Command("git", "diff", "--exit-code")
	cmd.Dir = camRoot
	if err := cmd.Run(); err != nil {
		v += "+"
	}
	return v
}

// verifyCamlistoreRoot crashes if dir isn't the Camlistore root directory.
func verifyCamlistoreRoot(dir string) {
	testFile := filepath.Join(dir, "pkg", "blob", "ref.go")
	if _, err := os.Stat(testFile); err != nil {
		log.Fatalf("make.go must be run from the Camlistore src root directory (where make.go is). Current working directory is %s", dir)
	}
}

func verifyGoVersion() {
	const neededMinor = '5'
	_, err := exec.LookPath("go")
	if err != nil {
		log.Fatalf("Go doesn't appeared to be installed ('go' isn't in your PATH). Install Go 1.%c or newer.", neededMinor)
	}
	out, err := exec.Command("go", "version").Output()
	if err != nil {
		log.Fatalf("Error checking Go version with the 'go' command: %v", err)
	}
	fields := strings.Fields(string(out))
	if len(fields) < 3 || !strings.HasPrefix(string(out), "go version ") {
		log.Fatalf("Unexpected output while checking 'go version': %q", out)
	}
	version := fields[2]
	if version == "devel" {
		return
	}
	// this check is still needed for the "go1" case.
	if len(version) < len("go1.") {
		log.Fatalf("Your version of Go (%s) is too old. Camlistore requires Go 1.%c or later.", version, neededMinor)
	}
	minorChar := strings.TrimPrefix(version, "go1.")[0]
	if minorChar >= neededMinor && minorChar <= '9' {
		return
	}
	log.Fatalf("Your version of Go (%s) is too old. Camlistore requires Go 1.%c or later.", version, neededMinor)
}

type walkOpts struct {
	dst    string // if non empty, mirror walked files to this destination.
	sqlite bool   // want sqlite package?
}

func walkDir(src string, opts walkOpts) (maxMod time.Time, err error) {
	err = filepath.Walk(src, func(path string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		base := fi.Name()
		if fi.IsDir() {
			if !opts.sqlite && strings.Contains(path, "mattn") && strings.Contains(path, "go-sqlite3") {
				return filepath.SkipDir
			}
			return nil
		}
		dir, _ := filepath.Split(path)
		parent := filepath.Base(dir)
		if (strings.HasPrefix(base, ".#") || !rxMirrored.MatchString(base)) && parent != "testdata" {
			return nil
		}
		suffix, err := filepath.Rel(src, path)
		if err != nil {
			return fmt.Errorf("Failed to find Rel(%q, %q): %v", src, path, err)
		}
		if t := fi.ModTime(); t.After(maxMod) {
			maxMod = t
		}
		if opts.dst != "" {
			return mirrorFile(path, filepath.Join(opts.dst, suffix))
		}
		return nil
	})
	return
}

func mirrorDir(src, dst string, opts walkOpts) (maxMod time.Time, err error) {
	opts.dst = dst
	return walkDir(src, opts)
}

var wantDestFile = make(map[string]bool) // full dest filename => true

func isExecMode(mode os.FileMode) bool {
	return (mode & 0111) != 0
}

func mirrorFile(src, dst string) error {
	wantDestFile[dst] = true
	sfi, err := os.Stat(src)
	if err != nil {
		return err
	}
	if sfi.Mode()&os.ModeType != 0 {
		log.Fatalf("mirrorFile can't deal with non-regular file %s", src)
	}
	dfi, err := os.Stat(dst)
	if err == nil &&
		isExecMode(sfi.Mode()) == isExecMode(dfi.Mode()) &&
		(dfi.Mode()&os.ModeType == 0) &&
		dfi.Size() == sfi.Size() &&
		dfi.ModTime().Unix() == sfi.ModTime().Unix() {
		// Seems to not be modified.
		return nil
	}

	dstDir := filepath.Dir(dst)
	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return err
	}

	df, err := os.Create(dst)
	if err != nil {
		return err
	}
	sf, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sf.Close()

	n, err := io.Copy(df, sf)
	if err == nil && n != sfi.Size() {
		err = fmt.Errorf("copied wrong size for %s -> %s: copied %d; want %d", src, dst, n, sfi.Size())
	}
	cerr := df.Close()
	if err == nil {
		err = cerr
	}
	if err == nil {
		err = os.Chmod(dst, sfi.Mode())
	}
	if err == nil {
		err = os.Chtimes(dst, sfi.ModTime(), sfi.ModTime())
	}
	return err
}

func deleteUnwantedOldMirrorFiles(dir string, withCamlistored bool) {
	filepath.Walk(dir, func(path string, fi os.FileInfo, err error) error {
		if err != nil {
			log.Fatalf("Error stating while cleaning %s: %v", path, err)
		}
		if fi.IsDir() {
			return nil
		}
		base := filepath.Base(path)
		if !wantDestFile[path] {
			if !withCamlistored && (strings.HasPrefix(base, "zembed_") || strings.Contains(path, "z_data.go")) {
				// If we're not building the camlistored binary,
				// no need to clean up the embedded Closure, JS,
				// CSS, HTML, etc. Doing so would just mean we'd
				// have to put it back into place later.
				return nil
			}
			if *verbose {
				log.Printf("Deleting old file from temp build dir: %s", path)
			}
			return os.Remove(path)
		}
		return nil
	})
}

func withSQLite() bool {
	cross := runtime.GOOS != *buildOS || runtime.GOARCH != *buildARCH
	var sql bool
	var err error
	if *sqlFlag == "auto" {
		sql = !cross && haveSQLite
	} else {
		sql, err = strconv.ParseBool(*sqlFlag)
		if err != nil {
			log.Fatalf("Bad boolean --sql flag %q", *sqlFlag)
		}
	}

	if cross && sql {
		log.Fatalf("SQLite isn't available when cross-compiling to another OS. Set --sqlite=false.")
	}
	if sql && !haveSQLite {
		log.Printf("SQLite not found. Either install it, or run make.go with --sqlite=false  See https://code.google.com/p/camlistore/wiki/SQLite")
		switch runtime.GOOS {
		case "darwin":
			log.Printf("On OS X, run 'brew install sqlite3 pkg-config'. Get brew from http://mxcl.github.io/homebrew/")
		case "linux":
			log.Printf("On Linux, run 'sudo apt-get install libsqlite3-dev' or equivalent.")
		case "windows":
			log.Printf("SQLite is not easy on windows. Please see http://camlistore.org/docs/server-config#windows")
		}
		os.Exit(2)
	}
	return sql
}

func checkHaveSQLite() bool {
	if runtime.GOOS == "windows" {
		// TODO: Find some other non-pkg-config way to test, like
		// just compiling a small Go program that sees whether
		// it's available.
		//
		// For now:
		return false
	}
	_, err := exec.LookPath("pkg-config")
	if err != nil {
		return false
	}
	out, err := exec.Command("pkg-config", "--libs", "sqlite3").Output()
	if err != nil && err.Error() == "exit status 1" {
		// This is sloppy (comparing against a string), but
		// doing it correctly requires using multiple *.go
		// files to portably get the OS-syscall bits, and I
		// want to keep make.go a single file.
		return false
	}
	if err != nil {
		log.Fatalf("Can't determine whether sqlite3 is available, and where. pkg-config error was: %v, %s", err, out)
	}
	return strings.TrimSpace(string(out)) != ""
}

func doEmbed() {
	if *verbose {
		log.Printf("Embedding resources...")
	}
	closureEmbed := buildSrcPath("server/camlistored/ui/closure/z_data.go")
	closureSrcDir := filepath.Join(camRoot, filepath.FromSlash("third_party/closure/lib"))
	err := embedClosure(closureSrcDir, closureEmbed)
	if err != nil {
		log.Fatal(err)
	}
	wantDestFile[closureEmbed] = true
	if err = buildGenfileembed(); err != nil {
		log.Fatal(err)
	}
	if err = genEmbeds(); err != nil {
		log.Fatal(err)
	}
}

func embedClosure(closureDir, embedFile string) error {
	if _, err := os.Stat(closureDir); err != nil {
		return fmt.Errorf("Could not stat %v: %v", closureDir, err)
	}

	// first collect the files and modTime
	var modTime time.Time
	type pathAndSuffix struct {
		path, suffix string
	}
	var files []pathAndSuffix
	err := filepath.Walk(closureDir, func(path string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		suffix, err := filepath.Rel(closureDir, path)
		if err != nil {
			return fmt.Errorf("Failed to find Rel(%q, %q): %v", closureDir, path, err)
		}
		if fi.IsDir() {
			return nil
		}
		if mt := fi.ModTime(); mt.After(modTime) {
			modTime = mt
		}
		files = append(files, pathAndSuffix{path, suffix})
		return nil
	})
	if err != nil {
		return err
	}
	// do not regenerate the whole embedFile if it exists and newer than modTime.
	if fi, err := os.Stat(embedFile); err == nil && fi.Size() > 0 && fi.ModTime().After(modTime) {
		if *verbose {
			log.Printf("skipping regeneration of %s", embedFile)
		}
		return nil
	}

	// second, zip it
	var zipbuf bytes.Buffer
	var zipdest io.Writer = &zipbuf
	if os.Getenv("CAMLI_WRITE_TMP_ZIP") != "" {
		f, _ := os.Create("/tmp/camli-closure.zip")
		zipdest = io.MultiWriter(zipdest, f)
		defer f.Close()
	}
	w := zip.NewWriter(zipdest)
	for _, elt := range files {
		b, err := ioutil.ReadFile(elt.path)
		if err != nil {
			return err
		}
		f, err := w.Create(filepath.ToSlash(elt.suffix))
		if err != nil {
			return err
		}
		if _, err = f.Write(b); err != nil {
			return err
		}
	}
	if err = w.Close(); err != nil {
		return err
	}

	// then embed it as a quoted string
	var qb bytes.Buffer
	fmt.Fprint(&qb, "package closure\n\n")
	fmt.Fprint(&qb, "import \"time\"\n\n")
	fmt.Fprint(&qb, "func init() {\n")
	fmt.Fprintf(&qb, "\tZipModTime = time.Unix(%d, 0)\n", modTime.Unix())
	fmt.Fprint(&qb, "\tZipData = ")
	quote(&qb, zipbuf.Bytes())
	fmt.Fprint(&qb, "\n}\n")

	// and write to a .go file
	if err := writeFileIfDifferent(embedFile, qb.Bytes()); err != nil {
		return err
	}
	return nil

}

func writeFileIfDifferent(filename string, contents []byte) error {
	fi, err := os.Stat(filename)
	if err == nil && fi.Size() == int64(len(contents)) && contentsEqual(filename, contents) {
		return nil
	}
	return ioutil.WriteFile(filename, contents, 0644)
}

func contentsEqual(filename string, contents []byte) bool {
	got, err := ioutil.ReadFile(filename)
	if os.IsNotExist(err) {
		return false
	}
	if err != nil {
		log.Fatalf("Error reading %v: %v", filename, err)
	}
	return bytes.Equal(got, contents)
}

// quote escapes and quotes the bytes from bs and writes
// them to dest.
func quote(dest *bytes.Buffer, bs []byte) {
	dest.WriteByte('"')
	for _, b := range bs {
		if b == '\n' {
			dest.WriteString(`\n`)
			continue
		}
		if b == '\\' {
			dest.WriteString(`\\`)
			continue
		}
		if b == '"' {
			dest.WriteString(`\"`)
			continue
		}
		if (b >= 32 && b <= 126) || b == '\t' {
			dest.WriteByte(b)
			continue
		}
		fmt.Fprintf(dest, "\\x%02x", b)
	}
	dest.WriteByte('"')
}

func exeName(s string) string {
	if *buildOS == "windows" {
		return s + ".exe"
	}
	return s
}

// goPackagePath returns the path to the provided Go package's
// source directory.
// pkg may be a path prefix without any *.go files.
// The error is os.ErrNotExist if GOPATH is unset or the directory
// doesn't exist in any GOPATH component.
func goPackagePath(pkg string) (path string, err error) {
	gp := os.Getenv("GOPATH")
	if gp == "" {
		return path, os.ErrNotExist
	}
	for _, p := range filepath.SplitList(gp) {
		dir := filepath.Join(p, "src", filepath.FromSlash(pkg))
		fi, err := os.Stat(dir)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return "", err
		}
		if !fi.IsDir() {
			continue
		}
		return dir, nil
	}
	return path, os.ErrNotExist
}
