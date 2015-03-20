#!/bin/sh

github-markup notes/Keybase-0.1.4.md > site/Keybase-0.1.4.html

ruby appcast.rb
