//
//  KBWindow.m
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBWindow.h"

@implementation KBWindow

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

+ (NSWindow *)windowWithContentView:(NSView *)contentView size:(CGSize)size retain:(BOOL)retain {
  NSWindow *window = [[NSWindow alloc] init];
  window.styleMask = NSClosableWindowMask | NSFullSizeContentViewWindowMask | NSTitledWindowMask;
  window.hasShadow = YES;
  window.titleVisibility = NSWindowTitleHidden;
  window.titlebarAppearsTransparent = YES;
  window.movableByWindowBackground = YES;
  contentView.frame = CGRectMake(0, 0, size.width, size.height);
  [window setContentSize:size];
  [window setContentView:contentView];

  // TODO: This will retain forever
  if (retain) [self registerWindow:window];
  return window;
}

+ (NSWindow *)windowWithContentView:(NSView *)contentView {
  NSWindow *window = [[NSWindow alloc] init];
  window.styleMask = NSClosableWindowMask | NSFullSizeContentViewWindowMask | NSTitledWindowMask;
  window.hasShadow = YES;
  window.titleVisibility = NSWindowTitleHidden;
  window.titlebarAppearsTransparent = YES;
  window.movableByWindowBackground = YES;
  [window setContentView:contentView];
  return window;
}

@end
