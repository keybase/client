// Copyright 2015 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"fmt"
	"go/build"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"text/template"
)

func goIOSBind(pkgs []*build.Package) error {
	srcDir := filepath.Join(tmpdir, "src", "gomobile_bind")
	genDir := filepath.Join(tmpdir, "gen")
	wrappers, err := GenObjcWrappers(pkgs, srcDir, genDir)
	if err != nil {
		return err
	}
	env := darwinArmEnv
	gopath := fmt.Sprintf("GOPATH=%s%c%s", genDir, filepath.ListSeparator, os.Getenv("GOPATH"))
	env = append(env, gopath)
	typesPkgs, err := loadExportData(pkgs, env)
	if err != nil {
		return err
	}

	astPkgs, err := parse(pkgs)
	if err != nil {
		return err
	}

	binder, err := newBinder(typesPkgs)
	if err != nil {
		return err
	}
	name := binder.pkgs[0].Name()
	title := strings.Title(name)

	if buildO != "" && !strings.HasSuffix(buildO, ".framework") {
		return fmt.Errorf("static framework name %q missing .framework suffix", buildO)
	}
	if buildO == "" {
		buildO = title + ".framework"
	}

	for _, pkg := range binder.pkgs {
		if err := binder.GenGo(pkg, binder.pkgs, srcDir); err != nil {
			return err
		}
	}
	// Generate the error type.
	if err := binder.GenGo(nil, binder.pkgs, srcDir); err != nil {
		return err
	}
	mainFile := filepath.Join(tmpdir, "src/iosbin/main.go")
	err = writeFile(mainFile, func(w io.Writer) error {
		_, err := w.Write(iosBindFile)
		return err
	})
	if err != nil {
		return fmt.Errorf("failed to create the binding package for iOS: %v", err)
	}

	fileBases := make([]string, len(typesPkgs)+1)
	for i, pkg := range binder.pkgs {
		if fileBases[i], err = binder.GenObjc(pkg, astPkgs[i], binder.pkgs, srcDir, wrappers); err != nil {
			return err
		}
	}
	if fileBases[len(fileBases)-1], err = binder.GenObjc(nil, nil, binder.pkgs, srcDir, wrappers); err != nil {
		return err
	}
	if err := binder.GenObjcSupport(srcDir); err != nil {
		return err
	}
	if err := binder.GenGoSupport(srcDir); err != nil {
		return err
	}

	cmd := exec.Command("xcrun", "lipo", "-create")

	for _, env := range [][]string{darwinArmEnv, darwinArm64Env, darwinAmd64Env} {
		env = append(env, gopath)
		arch := archClang(getenv(env, "GOARCH"))
		path, err := goIOSBindArchive(name, mainFile, env, fileBases)
		if err != nil {
			return fmt.Errorf("darwin-%s: %v", arch, err)
		}
		cmd.Args = append(cmd.Args, "-arch", arch, path)
	}

	// Build static framework output directory.
	if err := removeAll(buildO); err != nil {
		return err
	}
	headers := buildO + "/Versions/A/Headers"
	if err := mkdir(headers); err != nil {
		return err
	}
	if err := symlink("A", buildO+"/Versions/Current"); err != nil {
		return err
	}
	if err := symlink("Versions/Current/Headers", buildO+"/Headers"); err != nil {
		return err
	}
	if err := symlink("Versions/Current/"+title, buildO+"/"+title); err != nil {
		return err
	}

	cmd.Args = append(cmd.Args, "-o", buildO+"/Versions/A/"+title)
	if err := runCmd(cmd); err != nil {
		return err
	}

	// Copy header file next to output archive.
	headerFiles := make([]string, len(fileBases))
	if len(fileBases) == 1 {
		headerFiles[0] = title + ".h"
		err = copyFile(
			headers+"/"+title+".h",
			srcDir+"/"+bindPrefix+title+".objc.h",
		)
		if err != nil {
			return err
		}
	} else {
		for i, fileBase := range fileBases {
			headerFiles[i] = fileBase + ".objc.h"
			err = copyFile(
				headers+"/"+fileBase+".objc.h",
				srcDir+"/"+fileBase+".objc.h")
			if err != nil {
				return err
			}
		}
		err = copyFile(
			headers+"/ref.h",
			srcDir+"/ref.h")
		if err != nil {
			return err
		}
		headerFiles = append(headerFiles, title+".h")
		err = writeFile(headers+"/"+title+".h", func(w io.Writer) error {
			return iosBindHeaderTmpl.Execute(w, map[string]interface{}{
				"pkgs": pkgs, "title": title, "bases": fileBases,
			})
		})
		if err != nil {
			return err
		}
	}

	resources := buildO + "/Versions/A/Resources"
	if err := mkdir(resources); err != nil {
		return err
	}
	if err := symlink("Versions/Current/Resources", buildO+"/Resources"); err != nil {
		return err
	}
	if err := ioutil.WriteFile(buildO+"/Resources/Info.plist", []byte(iosBindInfoPlist), 0666); err != nil {
		return err
	}

	var mmVals = struct {
		Module  string
		Headers []string
	}{
		Module:  title,
		Headers: headerFiles,
	}
	err = writeFile(buildO+"/Versions/A/Modules/module.modulemap", func(w io.Writer) error {
		return iosModuleMapTmpl.Execute(w, mmVals)
	})
	if err != nil {
		return err
	}
	return symlink("Versions/Current/Modules", buildO+"/Modules")
}

const iosBindInfoPlist = `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
      <dict>
      </dict>
    </plist>
`

var iosModuleMapTmpl = template.Must(template.New("iosmmap").Parse(`framework module "{{.Module}}" {
	header "ref.h"
{{range .Headers}}    header "{{.}}"
{{end}}
    export *
}`))

func goIOSBindArchive(name, path string, env, fileBases []string) (string, error) {
	arch := getenv(env, "GOARCH")
	archive := filepath.Join(tmpdir, name+"-"+arch+".a")
	err := goBuild(path, env, "-buildmode=c-archive", "-o", archive)
	if err != nil {
		return "", err
	}

	return archive, nil
}

var iosBindFile = []byte(`
package main

import (
	_ "../gomobile_bind"
)

import "C"

func main() {}
`)

var iosBindHeaderTmpl = template.Must(template.New("ios.h").Parse(`
// Objective-C API for talking to the following Go packages
//
{{range .pkgs}}//	{{.ImportPath}}
{{end}}//
// File is generated by gomobile bind. Do not edit.
#ifndef __{{.title}}_FRAMEWORK_H__
#define __{{.title}}_FRAMEWORK_H__

{{range .bases}}#include "{{.}}.objc.h"
{{end}}
#endif
`))
