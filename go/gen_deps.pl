#!/usr/bin/env perl
use strict;
use warnings;
use 5.010;

use Data::Dumper qw(Dumper);
use JSON::PP qw(encode_json);

my $dep_packages = {};
my @oses = ('linux', 'darwin', 'windows');
my $os_packages = {};
my $total_packages = 0;
# Any packages to exclude. This needs to include CGO packages since those aren't cross-compilable.
my $excluded_pkg_regex = 'github.com/coreos/pkg/dlopen';

$ENV{'GOARCH'} = 'amd64';
foreach my $os (@oses) {
    $ENV{'GOOS'} = $os;
    my @packages = split /\n/, `go list ./... | grep -v github.com\\/keybase\\/client\\/go\\/bind`;
    $os_packages->{$os} = \@packages;
    $total_packages += scalar @packages;
}
say STDERR "total packages for which to calculate dependencies: $total_packages";

my $forks = 0;
foreach my $os (@oses) {
    my $pid = fork;
    if (not defined $pid) {
        warn "Could not fork for os: $os";
        next;
    }
    if ($pid) {
        # In the parent process
        $forks++;
        next;
    }
    $ENV{'GOOS'} = $os;
    my $i = 0;
    my $num_packages = scalar @{$os_packages->{$os}};
    foreach my $package (@{$os_packages->{$os}}) {
        $i++;
        my $percent_complete = (($i) * 100) / $num_packages;
        printf STDERR ("%7s: %3d of %3d complete (%3.0f%%) [%s]\n", $os, $i, $num_packages, $percent_complete, $package);

        # This should include vendored dependencies.
        my @deps = split /\n/, `go list -f '{{ printf "%s\\n%s\\n%s" (join .TestImports "\\n") (join .Imports "\\n") "$package" }}' "$package" 2>/dev/null | grep 'vendor\\|github.com/keybase/client' | sort | uniq`;
        my $deps = join(' ', @deps);
        my @indirect_deps = split /\n/, `go list -f '{{ join .Deps "\\n" }}' $deps 2>/dev/null | sort | uniq | grep 'vendor\\|github.com\\/keybase\\/client' | grep -v '$excluded_pkg_regex'`;
        push(@deps, @indirect_deps);

        foreach my $dep (do { my %deps; grep { !$deps{$_}++ } @deps}) {
            $dep_packages->{$os}->{$dep}->{$package} = 1;
        }
    }
    my $json_output = JSON::PP->new->utf8->pretty->canonical()->encode($dep_packages->{$os});
    open(my $fh, '>', ".go_package_deps_$os");
    print $fh "$json_output";
    close($fh);
    exit;
}

for (1 .. $forks) {
    my $pid = wait();
}
