// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

type fakePrompterForTest struct {
	nextResponse <-chan string
	prompts      chan<- string
}

func (p *fakePrompterForTest) Prompt(prompt string) (string, error) {
	if p.prompts != nil {
		p.prompts <- prompt
	}
	return <-p.nextResponse, nil
}

func (p *fakePrompterForTest) PromptPassword(prompt string) (string, error) {
	if p.prompts != nil {
		p.prompts <- prompt
	}
	return <-p.nextResponse, nil
}
