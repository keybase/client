//
//  KBWindow.m
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBWindow.h"
#import "KBNavigationView.h"
#import <YOLayout/YOCGUtils.h>

@interface NSView (KBView)
- (void)setupResponders;
@end

@interface KBWindow () <NSWindowDelegate>
@end

@implementation KBWindow

- (BOOL)canBecomeKeyWindow {
  return YES;
}

- (BOOL)canBecomeMainWindow {
  return YES;
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

+ (KBWindow *)windowWithContentView:(NSView *)contentView size:(CGSize)size retain:(BOOL)retain {
  KBWindow *window = [[KBWindow alloc] init];
  window.styleMask = NSClosableWindowMask | NSFullSizeContentViewWindowMask | NSTitledWindowMask;
  window.hasShadow = YES;
  window.titleVisibility = NSWindowTitleHidden;
  window.titlebarAppearsTransparent = YES;
  window.movableByWindowBackground = YES;
  window.delegate = window;
  contentView.frame = CGRectMake(0, 0, size.width, size.height);
  [window setContentSize:size];
  [window setContentView:contentView];

  // TODO: This will retain forever
  if (retain) [self registerWindow:window];
  return window;
}

+ (KBWindow *)windowWithContentView:(NSView *)contentView {
  KBWindow *window = [[KBWindow alloc] init];
  window.styleMask = NSClosableWindowMask | NSFullSizeContentViewWindowMask | NSTitledWindowMask;
  window.hasShadow = YES;
  window.titleVisibility = NSWindowTitleHidden;
  window.titlebarAppearsTransparent = YES;
  window.movableByWindowBackground = YES;
  window.delegate = window;
  [window setContentView:contentView];
  return window;
}

- (NSRect)window:(NSWindow *)window willPositionSheet:(NSWindow *)sheet usingRect:(NSRect)rect {
  rect.origin.y += -_sheetPosition;
  return rect;
}

@end

@implementation NSWindow (KBWindow)

- (NSWindow *)kb_addChildWindowForView:(YOView *)view rect:(CGRect)rect position:(KBWindowPosition)position title:(NSString *)title fixed:(BOOL)fixed makeKey:(BOOL)makeKey {
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:title];

  CGSize size = [view sizeThatFits:rect.size];
  size.height += 32; // TODO

  KBWindow *window = [KBWindow windowWithContentView:navigation size:size retain:YES];
  window.sheetPosition = 33;
  if (fixed) {
    [window setMovable:NO];
  } else {
    window.styleMask = window.styleMask | NSResizableWindowMask;
  }

  [self kb_addChildWindow:window rect:CGRectMake(0, 0, size.width, size.height) position:position fixed:fixed];

  if ([view respondsToSelector:@selector(setupResponders)]) [view setupResponders];

  if (makeKey) {
    [window makeKeyAndOrderFront:nil];
  }
  return window;
}

- (void)kb_addChildWindow:(NSWindow *)window rect:(CGRect)rect position:(KBWindowPosition)position fixed:(BOOL)fixed {
  if (fixed) {
    [window setMovable:NO];
  } else {
    window.styleMask = window.styleMask | NSResizableWindowMask;
  }

  CGPoint p = CGPointMake(self.frame.origin.x + rect.origin.x, self.frame.origin.y + rect.origin.y);

  switch (position) {
    case KBWindowPositionCenter:
      p.x += YOCGPointToCenterX(window.frame.size, self.frame.size).x;
      p.y = self.frame.origin.y + self.frame.size.height - window.frame.size.height;
      break;
    case KBWindowPositionRight:
      p.x += self.frame.size.width + 10;
      //      for (NSWindow *window in self.childWindows) {
      //        p.x += window.frame.size.width + 10;
      //      }
      break;
  }
  [window setFrameOrigin:p];
  [window setContentSize:rect.size];

  [self addChildWindow:window ordered:NSWindowAbove];
}


@end
