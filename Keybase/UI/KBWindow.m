//
//  KBWindow.m
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBWindow.h"

#import "KBLogoView.h"

@implementation KBWindow

- (instancetype)initWithContentView:(NSView *)contentView size:(CGSize)size {
  if ((self = [super init])) {
    self.styleMask = NSClosableWindowMask | NSFullSizeContentViewWindowMask | NSTitledWindowMask |NSTexturedBackgroundWindowMask;
    self.hasShadow = YES;
    self.titleVisibility = NSWindowTitleHidden;
    self.titlebarAppearsTransparent = YES;
    self.movableByWindowBackground = YES;
    [self setContentSize:size];
    contentView.frame = CGRectMake(0, 0, size.width, size.height);

    self.navigation = [[KBNavigationView alloc] init];
    [self setContentView:self.navigation];
    [self.navigation setView:contentView transitionType:KBNavigationTransitionTypeNone];
  }
  return self;
}

/*!
 Otherwise the window will disappear when its released.
 */
+ (void)registerWindow:(NSWindow *)window {
  static dispatch_once_t onceToken;
  static NSMutableArray *gRegisteredWindows;
  dispatch_once(&onceToken, ^{
    gRegisteredWindows = [NSMutableArray array];
  });
  [gRegisteredWindows addObject:window];
}

+ (instancetype)windowWithContentView:(NSView *)contentView size:(CGSize)size retain:(BOOL)retain {
  KBWindow *window = [[self alloc] initWithContentView:contentView size:size];
  if (retain) [self registerWindow:window];
  return window;
}

@end
