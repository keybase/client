//
//  KBPath.m
//  Keybase
//
//  Created by Gabriel on 8/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBPath.h"

@implementation KBPath

+ (NSString *)path:(NSString *)path {
  path = [path stringByExpandingTildeInPath];
  return [path stringByReplacingOccurrencesOfString:@"\\ " withString:@" "];
}

+ (NSString *)pathInDir:(NSString *)dir path:(NSString *)path {
  path = [self path:path];
  if (!path) return nil;
  dir = [self path:dir];
  return dir ? [dir stringByAppendingPathComponent:path] : path;
}

@end
