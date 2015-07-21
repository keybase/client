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
- (void)setNavigation:(KBNavigationView *)navigation;
- (void)viewDidAppear:(BOOL)animated;
@end

@interface KBWindow () <NSWindowDelegate>
@property BOOL modal;
@property BOOL modalShowing;
@end

@implementation KBWindow

- (BOOL)canBecomeKeyWindow {
  return YES;
}

- (BOOL)canBecomeMainWindow {
  return YES;
}

//- (void)sendEvent:(NSEvent *)event {
//  if (!_modalShowing) [super sendEvent:event];
//}

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

- (KBWindow *)addModalWindowForView:(YOView *)view rect:(CGRect)rect {
  CGSize size = [view sizeThatFits:rect.size];
  KBWindow *window = [KBWindow windowWithContentView:view size:size retain:YES];
  [window setMovable:NO];

  window.styleMask = NSFullSizeContentViewWindowMask | NSTitledWindowMask;

  [self kb_addChildWindow:window rect:CGRectMake(rect.origin.x, rect.origin.y, size.width, size.height) position:KBWindowPositionCenter];

  window.modal = YES;
  self.modalShowing = YES;
  [window makeKeyAndOrderFront:nil];

  if ([view respondsToSelector:@selector(viewDidAppear:)]) [view viewDidAppear:NO];
  return window;
}

#pragma mark NSWindowDelegate

- (NSRect)window:(NSWindow *)window willPositionSheet:(NSWindow *)sheet usingRect:(NSRect)rect {
  rect.origin.y += -_sheetPosition;
  return rect;
}

- (void)windowWillClose:(NSNotification *)notification {
  if (self.modal) {
    NSAssert([self.parentWindow isKindOfClass:KBWindow.class], @"Modal parent should be KBWindow");
    KBWindow *parentWindow = (KBWindow *)self.parentWindow;
    parentWindow.modalShowing = NO;
  }
}

@end

@implementation NSWindow (KBWindow)

- (NSWindow *)kb_addChildWindowForView:(NSView *)view size:(CGSize)size makeKey:(BOOL)makeKey {
  KBWindow *window = [KBWindow windowWithContentView:view size:size retain:YES];

  window.styleMask = NSFullSizeContentViewWindowMask | NSTitledWindowMask;

  [self kb_addChildWindow:window rect:CGRectMake(0, 0, size.width, size.height) position:KBWindowPositionCenter];

  if (makeKey) [window makeKeyAndOrderFront:nil];
  if ([view respondsToSelector:@selector(viewDidAppear:)]) [view viewDidAppear:NO];
  return window;
}

- (NSWindow *)kb_addChildWindowForView:(YOView *)view rect:(CGRect)rect position:(KBWindowPosition)position title:(NSString *)title fixed:(BOOL)fixed makeKey:(BOOL)makeKey {
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:title];
  if ([view respondsToSelector:@selector(setNavigation:)]) {
    [view setNavigation:navigation];
  }

  CGSize viewSize = [view sizeThatFits:rect.size];
  viewSize.height += 32; // TODO

  KBWindow *window = [KBWindow windowWithContentView:navigation size:viewSize retain:YES];
  window.sheetPosition = 32;
  if (fixed) {
    [window setMovable:NO];
  } else {
    window.styleMask = window.styleMask | NSResizableWindowMask;
  }

  [self kb_addChildWindow:window rect:CGRectMake(rect.origin.x, rect.origin.y, viewSize.width, viewSize.height) position:position];

  if (makeKey) {
    [window makeKeyAndOrderFront:nil];
  }
  if ([view respondsToSelector:@selector(viewDidAppear:)]) [view viewDidAppear:NO];
  return window;
}

- (void)kb_addChildWindow:(NSWindow *)window rect:(CGRect)rect position:(KBWindowPosition)position {

  CGPoint p = CGPointMake(self.frame.origin.x + rect.origin.x, self.frame.origin.y + rect.origin.y);

  switch (position) {
    case KBWindowPositionCenter:
      p.x +=  ceilf((self.frame.size.width - window.frame.size.width)/2.0f);
      p.y += ceilf(self.frame.size.height/2.0 - window.frame.size.height/2.0);
      break;
    case KBWindowPositionRight:
      p.x += self.frame.size.width + 10;
      break;
    case KBWindowPositionLeft:
      p.x -= (window.frame.size.width + 10);
      break;
  }
  [window setFrameOrigin:p];
  [window setContentSize:rect.size];

  [self addChildWindow:window ordered:NSWindowAbove];
}


@end
