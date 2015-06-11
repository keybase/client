//
//  KBInstallable.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBComponent.h"

@implementation KBComponent

- (NSView *)componentView { return nil; }

- (void)install:(KBCompletion)completion { completion(KBMakeError(-1, @"Nothing to install")); }

- (void)refreshComponent:(KBCompletion)completion { completion(nil); }

@end


