// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"testing"

	"github.com/blevesearch/bleve"
	"github.com/blevesearch/bleve/index/store/gtreap"
	"github.com/blevesearch/bleve/mapping"
	"github.com/stretchr/testify/require"
)

const (
	testMappingText = "A new span of the Golden Gate Bridge is complete"
	testMappingHTML = "<span>The Golden Gate Bridge is actually red</span>"
)

type testMappingTextFile struct {
	Name string
	Text string
}

var _ mapping.Classifier = testMappingTextFile{}

func (tf testMappingTextFile) Type() string {
	return textFileType
}

type testMappingHTMLFile struct {
	Name string
	HTML string
}

var _ mapping.Classifier = testMappingHTMLFile{}

func (hf testMappingHTMLFile) Type() string {
	return htmlFileType
}

func TestIndexMapping(t *testing.T) {
	indexMapping, err := makeIndexMapping()
	require.NoError(t, err)

	index, err := bleve.NewUsing(
		"", indexMapping, bleveIndexType, gtreap.Name, nil)
	require.NoError(t, err)

	t.Log("Insert text file into the index")
	textID := "text"
	tf := testMappingTextFile{"textFile", testMappingText}
	err = index.Index(textID, tf)
	require.NoError(t, err)

	t.Log("Insert HTML file into the index")
	htmlID := "html"
	hf := testMappingHTMLFile{"htmlFile", testMappingHTML}
	err = index.Index(htmlID, hf)
	require.NoError(t, err)

	t.Log("Search for a common text word")
	query := bleve.NewQueryStringQuery("golden")
	request := bleve.NewSearchRequest(query)
	result, err := index.Search(request)
	require.NoError(t, err)
	require.Len(t, result.Hits, 2)

	t.Log("Search for an HTML tag word")
	query = bleve.NewQueryStringQuery("span")
	request = bleve.NewSearchRequest(query)
	result, err = index.Search(request)
	require.NoError(t, err)
	require.Len(t, result.Hits, 1)

	t.Log("Make sure stop words aren't indexed")
	query = bleve.NewQueryStringQuery("the")
	request = bleve.NewSearchRequest(query)
	result, err = index.Search(request)
	require.NoError(t, err)
	require.Len(t, result.Hits, 0)
}
