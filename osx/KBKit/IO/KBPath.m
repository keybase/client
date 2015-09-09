//
//  KBPath.m
//  Keybase
//
//  Created by Gabriel on 8/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBPath.h"

@interface KBPath ()
@property NSString *canonicalPath;
@end

@implementation KBPath

+ (instancetype)path:(NSString *)path {
  KBPath *p = [[KBPath alloc] init];
  path = [path stringByExpandingTildeInPath];
  path = [path stringByReplacingOccurrencesOfString:@"\\ " withString:@" "];
  p.canonicalPath = path;
  return p;
}

- (NSString *)pathWithOptions:(KBPathOptions)options {
  return [self pathInDir:nil options:options];
}

- (NSString *)pathInDir:(NSString *)dir options:(KBPathOptions)options {
  if (!_canonicalPath) return nil;
  dir = [KBPath path:dir options:0]; // Expand
  NSString *path = dir ? [dir stringByAppendingPathComponent:_canonicalPath] : _canonicalPath;
  if (options & KBPathOptionsTilde) path = [path stringByAbbreviatingWithTildeInPath];
  if (options & KBPathOptionsEscape) path = [path stringByReplacingOccurrencesOfString:@" " withString:@"\\ "];
  return path;
}

+ (NSString *)path:(NSString *)path options:(KBPathOptions)options {
  return [[KBPath path:path] pathWithOptions:options];
}

+ (NSString *)pathInDir:(NSString *)dir path:(NSString *)path options:(KBPathOptions)options {
  return [[KBPath path:path] pathInDir:dir options:options];
}

@end


NSString *KBPathTilde(NSString *path) {
  return [KBPath path:path options:KBPathOptionsTilde];
}