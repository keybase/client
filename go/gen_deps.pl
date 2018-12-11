#!/usr/bin/env perl
use strict;
use warnings;
use 5.010;

use Data::Dumper qw(Dumper);
use JSON::PP qw(encode_json);

my @packages = split /\n/, `go list ./...`;
my %dep_packages;
my $num_packages = @packages;

for (my $i=0; $i<$num_packages; $i++) {
    my $package = $packages[$i];
    my $percent_complete = (($i + 1) * 100) / $num_packages;
    say STDERR "\rparsing package $package";
    printf STDERR ("%d of %d complete (%.1f%%)", $i+1, $num_packages, $percent_complete);

    # This should include vendored dependencies.
    my @deps = split /\n/, `go list -f '{{ print (join .TestImports "\\n") "\\n" (join .Imports "\\n") }}' "$package" 2>/dev/null | xargs go list -f '{{ join .Deps "\\n" }}' 2>/dev/null | sort | uniq | grep 'vendor\\|github.com\\/keybase\\/client'`;

    foreach my $dep (@deps) {
        $dep_packages{$dep}{$package} = 1;
    }
}
say STDERR "";

my $json_output = JSON::PP->new->utf8->pretty->canonical()->encode(\%dep_packages);
open(my $fh, '>', '.go_package_deps');
print $fh "$json_output";
close($fh);
