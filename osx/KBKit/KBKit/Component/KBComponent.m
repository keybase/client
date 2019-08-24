//
//  KBInstallable.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBComponent.h"

@interface KBComponent ()
@property NSString *name;
@property NSString *info;
@property NSImage *image;
@end

@implementation KBComponent

- (instancetype)initWithName:(NSString *)name info:(NSString *)info image:(NSImage *)image {
  if ((self = [super init])) {
    self.name = name;
    self.info = info;
    self.image = image;
  }
  return self;
}

- (NSView *)componentView { return nil; }

- (void)install:(KBCompletion)completion { completion(KBMakeError(KBErrorCodeUnsupported, @"Unsupported")); }

- (void)refreshComponent:(KBRefreshComponentCompletion)completion { completion(nil); }

@end


@implementation KBFSUtils

+(BOOL)checkIfPathIsFishy:(NSString *)path {
    NSArray *v = [path componentsSeparatedByString:@"/"];
    for (int i = 0; i < v.count; i++) {
        if ([v[i] isEqualToString:@".."]) {
            return YES;
        }
        if ([v[i] isEqualToString:@"."]) {
            return YES;
        }
    }

    // Only allow vanilla characters in our paths. A whitelist approach, as opposed to a
    // blacklist.
    NSError *error = NULL;
    NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:@"^[a-zA-Z0-9./_() -]+$" options:0 error:&error];
    if (!regex) {
        return YES;
    }
    NSTextCheckingResult *match = [regex firstMatchInString:path options:0 range:NSMakeRange(0, [path length])];
    if (!match) {
        return YES;
    }
    return NO;
}

/*
 * check that the path path has the prefix prefix, being wise to
 * whatever attacks people will throw at us, like /a/b/../../.., etc
 */
+(BOOL)checkAbsolutePath:(NSString *)path hasAbsolutePrefix:(NSString *)prefix {
    if (!prefix.absolutePath) {
        return NO;
    }
    if (!path.absolutePath) {
        return NO;
    }
    if ([self checkIfPathIsFishy:path]) {
        return NO;
    }
    if ([self checkIfPathIsFishy:prefix]) {
        return NO;
    }
    NSArray *a = [path   componentsSeparatedByString:@"/"];
    NSArray *b = [prefix componentsSeparatedByString:@"/"];
    if (a.count < b.count) {
        return NO;
    }

    for (int i = 0; i < b.count; i++) {
        if (![a[i] isEqualToString:b[i]]) {
            return NO;
        }
    }
    return YES;
}

@end
