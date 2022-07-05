// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"github.com/blevesearch/bleve"
	"github.com/blevesearch/bleve/analysis"
	"github.com/blevesearch/bleve/analysis/char/html"
	"github.com/blevesearch/bleve/analysis/token/lowercase"
	"github.com/blevesearch/bleve/analysis/tokenizer/web"
	"github.com/blevesearch/bleve/mapping"
	"github.com/blevesearch/bleve/registry"
)

const (
	htmlAnalyzerName = "kbfsHTML"
	htmlFieldName    = "HTML"
)

func htmlAnalyzerConstructor(
	config map[string]interface{}, cache *registry.Cache) (
	*analysis.Analyzer, error) {
	tokenizer, err := cache.TokenizerNamed(web.Name)
	if err != nil {
		return nil, err
	}
	htmlFilter, err := cache.CharFilterNamed(html.Name)
	if err != nil {
		return nil, err
	}
	toLowerFilter, err := cache.TokenFilterNamed(lowercase.Name)
	if err != nil {
		return nil, err
	}
	rv := analysis.Analyzer{
		Tokenizer: tokenizer,
		CharFilters: []analysis.CharFilter{
			htmlFilter,
		},
		TokenFilters: []analysis.TokenFilter{
			toLowerFilter,
		},
	}
	return &rv, nil
}

func init() {
	registry.RegisterAnalyzer(htmlAnalyzerName, htmlAnalyzerConstructor)
}

func makeIndexMapping() (*mapping.IndexMappingImpl, error) {
	// Register a mapping for text and HTML files, so when we index
	// text files we can mark them as such.
	indexMapping := bleve.NewIndexMapping()

	textMapping := mapping.NewDocumentMapping()
	indexMapping.AddDocumentMapping(textFileType, textMapping)

	htmlFieldMapping := mapping.NewTextFieldMapping()
	htmlFieldMapping.Analyzer = htmlAnalyzerName
	htmlDocMapping := mapping.NewDocumentMapping()
	htmlDocMapping.AddFieldMappingsAt(htmlFieldName, htmlFieldMapping)
	indexMapping.AddDocumentMapping(htmlFileType, htmlDocMapping)

	return indexMapping, nil
}
