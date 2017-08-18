//
//  KBSemVersion.m
//  Keybase
//
//  Created by Gabriel on 8/21/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import "KBSemVersion.h"

#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBSemVersion ()
@property NSString *version;
@property NSInteger major;
@property NSInteger minor;
@property NSInteger patch;
@property NSString *build;
@end

@implementation KBSemVersion

+ (instancetype)version:(NSString *)version {
  if (!version) return nil;
  if ([version isEqualToString:@""]) return nil;

  NSArray *split = [version split:@"-"];
  if (split.count == 0) return [[KBSemVersion alloc] init];

  version = [split[0] strip];
  if ([version isEqualToString:@""]) version = nil;

  // Rejoin rest of split string (with -) which handles build numbers with dashes
  NSString *build = [(split.count > 1 ? [[split subarrayWithRange:NSMakeRange(1, split.count - 1)] join:@"-"] : nil) strip];
  if ([build isEqualToString:@""]) build = nil;
  // If version == build, then ignore build
  build = ([build isEqualToString:version] ? nil : build);

  KBSemVersion *v = [[KBSemVersion alloc] init];
  v.version = version;
  v.build = build;


  NSArray *versionSplit = [version split:@"."];
  v.major = versionSplit.count > 0 ? [versionSplit[0] integerValue] : 0;
  v.minor = versionSplit.count > 1 ? [versionSplit[1] integerValue] : 0;
  v.patch = versionSplit.count > 2 ? [versionSplit[2] integerValue] : 0;

  return v;
}

+ (instancetype)version:(NSString *)version build:(NSString *)build {
  KBSemVersion *v = [self version:version];
  build = [build strip];
  if ([build isEqualToString:@""]) build = nil;
  v.build = build;
  return v;
}

- (NSComparisonResult)compare:(KBSemVersion *)v {
  NSComparisonResult result = [@(self.major) compare:@(v.major)];
  if (result != NSOrderedSame) return result;

  result = [@(self.minor) compare:@(v.minor)];
  if (result != NSOrderedSame) return result;

  result = [@(self.patch) compare:@(v.patch)];
  if (result != NSOrderedSame) return result;

  result = [@([self.build integerValue]) compare:@([v.build integerValue])];
  if (result != NSOrderedSame) return result;

  return NSOrderedSame;
}

- (BOOL)isLessThan:(KBSemVersion *)v {
  return [self compare:v] == NSOrderedAscending;
}

- (BOOL)isOrderedSame:(KBSemVersion *)v {
  return [self compare:v] == NSOrderedSame;
}

- (BOOL)isGreaterThan:(KBSemVersion *)v {
  return [self compare:v] == NSOrderedDescending;
}

- (NSString *)description {
  if (self.version && self.build) return [NSString stringWithFormat:@"%@-%@", self.version, self.build];
  return self.version ? self.version : @"";
}

@end
