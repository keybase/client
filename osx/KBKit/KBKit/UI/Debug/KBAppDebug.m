//
//  KBAppDebug.m
//  Keybase
//
//  Created by Gabriel on 6/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBAppDebug.h"

#import "KBStyleGuideView.h"
#import "KBDefines.h"
#import <CocoaLumberjack/CocoaLumberjack.h>

@interface KBAppDebug ()
@property BOOL running;
@end

@implementation KBAppDebug

- (void)viewInit {
  [super viewInit];
}

- (void)_consoleDebug:(NSTimeInterval)delay {
  GHWeakSelf gself = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, delay * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    DDLogDebug(@"%@", @"Tote bag XOXO cred, whatever retro Etsy American Apparel single-origin coffee sustainable Pitchfork mlkshk quinoa meh. Kale chips plaid crucifix migas, sriracha brunch American Apparel twee. Cray you probably haven't heard of them mustache flannel health goth fingerstache. Beard mlkshk lumbersexual narwhal. Flexitarian art party four dollar toast cred, brunch fixie distillery.");

    if (gself.running) {
      [gself _consoleDebug:0.5];
    }
  });
}

@end
