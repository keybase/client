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
	Name     string
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

func makeDoc(
	ctx context.Context, config libkbfs.Config, n libkbfs.Node,
	ei data.EntryInfo, revision kbfsmd.Revision, mtime time.Time) (
	interface{}, error) {
	contentType, err := getContentType(ctx, config, n, ei)
	if err != nil {
		return nil, err
	}

	base := indexedBase{
		Name:     n.GetBasename().Plaintext(),
		TlfID:    n.GetFolderBranch().Tlf,
		Revision: revision,
		Mtime:    mtime,
	}
	s := strings.Split(contentType, ";")
	switch s[0] {
	case "text/html", "text/xml":
		text, err := getTextToIndex(ctx, config, n, ei)
		if err != nil {
			return nil, err
		}
		return indexedHTMLFile{base, text}, nil
	case "text/plain":
		text, err := getTextToIndex(ctx, config, n, ei)
		if err != nil {
			return nil, err
		}
		return indexedTextFile{base, text}, nil
	default:
		// Unindexable content type.
		return base, nil
	}
}
