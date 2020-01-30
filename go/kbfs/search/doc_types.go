// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"
	"unicode"

	"github.com/blevesearch/bleve/mapping"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
)

const (
	maxTextToIndex = uint64(10 * 1024 * 1024)

	// Copied from net/http/sniff.go: the algorithm uses at most
	// sniffLen bytes to make its decision.
	sniffLen = uint64(512)
)

type indexedBase struct {
	TlfID    tlf.ID
	Revision kbfsmd.Revision
	Mtime    time.Time
}

type indexedTextFile struct {
	indexedBase
	Text string
}

var _ mapping.Classifier = indexedTextFile{}

func (itf indexedTextFile) Type() string {
	return textFileType
}

type indexedHTMLFile struct {
	indexedBase
	HTML string
}

var _ mapping.Classifier = indexedHTMLFile{}

func (ihf indexedHTMLFile) Type() string {
	return htmlFileType
}

func getContentType(
	ctx context.Context, config libkbfs.Config, n libkbfs.Node,
	ei data.EntryInfo) (contentType string, err error) {
	name := n.GetBasename()
	contentType = mime.TypeByExtension(filepath.Ext(name.Plaintext()))
	if len(contentType) > 0 {
		return contentType, nil
	}

	bufLen := sniffLen
	if ei.Size < bufLen {
		bufLen = ei.Size
	}
	buf := make([]byte, bufLen)

	nBytes, err := config.KBFSOps().Read(ctx, n, buf, 0)
	if err != nil {
		return "", err
	}
	if nBytes < int64(len(buf)) {
		buf = buf[:nBytes]
	}

	return http.DetectContentType(buf), nil
}

func getTextToIndex(
	ctx context.Context, config libkbfs.Config, n libkbfs.Node,
	ei data.EntryInfo) (data string, err error) {
	bufLen := ei.Size
	if bufLen > maxTextToIndex {
		bufLen = maxTextToIndex
	}
	buf := make([]byte, bufLen)
	nBytes, err := config.KBFSOps().Read(ctx, n, buf, 0)
	if err != nil {
		return "", err
	}
	if nBytes < int64(len(buf)) {
		buf = buf[:nBytes]
	}

	return string(buf), nil
}

type indexedName struct {
	indexedBase
	Name          string
	TokenizedName string
}

var _ mapping.Classifier = indexedName{}

func (in indexedName) Type() string {
	return textFileType
}

func removePunct(r rune) rune {
	if unicode.IsPunct(r) {
		return ' '
	}
	return r
}

func makeNameDocWithBase(
	n libkbfs.Node, base indexedBase) (nameDoc interface{}) {
	// Turn all punctuation into spaces to allow for matching
	// individual words within the filename.
	fullName := n.GetBasename().Plaintext()
	tokenizedName := strings.Map(removePunct, fullName)
	return indexedName{
		indexedBase:   base,
		Name:          fullName,
		TokenizedName: tokenizedName,
	}
}

func makeNameDoc(
	n libkbfs.Node, revision kbfsmd.Revision, mtime time.Time) (
	nameDoc interface{}) {
	base := indexedBase{
		TlfID:    n.GetFolderBranch().Tlf,
		Revision: revision,
		Mtime:    mtime,
	}
	return makeNameDocWithBase(n, base)
}

func makeDoc(
	ctx context.Context, config libkbfs.Config, n libkbfs.Node,
	ei data.EntryInfo, revision kbfsmd.Revision, mtime time.Time) (
	doc, nameDoc interface{}, err error) {
	base := indexedBase{
		TlfID:    n.GetFolderBranch().Tlf,
		Revision: revision,
		Mtime:    mtime,
	}

	// Name goes in a separate doc, so we can rename a file without
	// having to re-index all of its contents.
	name := makeNameDocWithBase(n, base)

	// Non-files only get a name to index.
	if ei.Type != data.File && ei.Type != data.Exec {
		return nil, name, nil
	}

	// Make a doc for the contents, depending on the content type.
	contentType, err := getContentType(ctx, config, n, ei)
	if err != nil {
		return nil, nil, err
	}
	s := strings.Split(contentType, ";")
	switch s[0] {
	case "text/html", "text/xml":
		text, err := getTextToIndex(ctx, config, n, ei)
		if err != nil {
			return nil, nil, err
		}
		return indexedHTMLFile{base, text}, name, nil
	case "text/plain":
		text, err := getTextToIndex(ctx, config, n, ei)
		if err != nil {
			return nil, nil, err
		}
		return indexedTextFile{base, text}, name, nil
	default:
		// Unindexable content type.
		return base, name, nil
	}
}
