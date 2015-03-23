#!/bin/sh

github-markup notes/Keybase-0.1.5.md > site/Keybase-0.1.5.html

ruby appcast.rb
