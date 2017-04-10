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


