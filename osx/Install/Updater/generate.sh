#!/bin/sh

github-markup notes/Keybase-0.1.7.md > site/Keybase-0.1.7.html

ruby appcast.rb
