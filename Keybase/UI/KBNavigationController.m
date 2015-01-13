//
//  KBNavigationController.h
//  Keybase
//
//  Created by Gabriel on 12/22/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBNavigationController.h"

typedef NS_ENUM (NSInteger, KBNavigationDirection) {
  KBNavigationDirectionBack = -1,
  KBNavigationDirectionForward = 1
};

@interface NSView (KBNavigation)
- (void)setNavigationController:(KBNavigationController *)controller;
- (void)viewWillAppear:(BOOL)animated;
- (void)viewDidAppear:(BOOL)animated;
- (void)viewWillDisappear:(BOOL)animated;
- (void)viewDidDisappear:(BOOL)animated;
@end

@interface KBNavigationController ()
@property (nonatomic) NSMutableArray *views;
@end

@implementation KBNavigationController

- (void)pushView:(NSView *)view animated:(BOOL)animated {
  if (animated) {
    if ([self.transition.type isEqualToString:kCATransitionPush]) self.transition.subtype = kCATransitionFromRight;
    self.view.animations = @{@"subviews": self.transition};
  }
  
  [self _pushView:view animated:animated];
}

- (void)pushView:(NSView *)view transition:(CATransition *)transition transactionBlock:(void (^)())transactionBlock {
  if (transition) {
    self.view.animations = @{@"subviews": transition};
  } else {
    self.view.animations = @{@"subviews": self.transition};
  }
  
  if (transactionBlock) {
    [CATransaction begin];
    if (transactionBlock) transactionBlock();
    [self _pushView:view animated:YES];
    [CATransaction commit];
  } else {
    [self _pushView:view animated:YES];
  }
}

- (void)popViewAnimated:(BOOL)animated {
  if (!self.views || self.views.count == 1) {
    @throw [NSException exceptionWithName:@"Cannot pop view controller" reason:@"KBNavigationController must have at least 1 child view controller" userInfo:@{}];
    return;
  }
  
  if (animated) {
    if ([self.transition.type isEqualToString:kCATransitionPush]) self.transition.subtype = kCATransitionFromLeft;
    self.view.animations = @{@"subviews": self.transition};
  } else {
    self.view.animations = @{@"subviews": [NSNull null]};
  }
  
  NSView *previousView = [self previousView];
  NSView *currentView = [self currentView];
  
  [self replaceView:currentView withView:previousView animated:animated direction:KBNavigationDirectionBack];
  
  [self removeView:[self currentView]];
}

- (NSMutableArray *)views {
  if (!_views) _views = [NSMutableArray array];
  return _views;
}

- (CATransition *)transition {
  // Create a default transition if not set
  if (!_transition) {
    _transition = [CATransition animation];
    _transition.type = kCATransitionPush;
    _transition.subtype = kCATransitionFromRight;
  }
  
  return _transition;
}

- (void)setRootView:(NSView *)rootView {
  _rootView = rootView;
  [self.view addSubview:self.rootView];
  [self addView:self.rootView];

  [self.rootView viewWillAppear:NO];
  [self.rootView viewDidAppear:NO];
}

- (void)addView:(NSView *)view {
  NSMutableArray *views = [self.views mutableCopy];
  [views addObject:view];
  _views = views;  
  [view setNavigationController:self];
}

- (void)removeView:(NSView *)view {
  NSMutableArray *views = [self.views mutableCopy];
  [views removeObject:view];
  _views = views;  
  [view setNavigationController:nil];
}

- (NSView *)currentView {
  if (self.views.count == 0) return nil;
  return self.views[self.views.count-1];
}

- (NSView *)previousView {
  if ([self currentView] == self.rootView) return nil;
  
  return self.views[self.views.count-2];
}

- (void)_pushView:(NSView *)view animated:(BOOL)animated {
  NSView *currentView = [self currentView];

  view.frame = self.view.frame;

  [self replaceView:currentView withView:view animated:animated direction:KBNavigationDirectionForward];
  [self addView:view];
}

- (void)replaceView:(NSView *)outView withView:(NSView *)inView animated:(BOOL)animated direction:(KBNavigationDirection)direction {
  if (animated) {
    [CATransaction begin]; {
      [outView viewWillDisappear:animated];
      [inView viewWillAppear:animated];
      
      [CATransaction setCompletionBlock:^{
        [inView viewDidAppear:animated];
        [outView viewDidDisappear:animated];
      }];
      
      [self.view.animator replaceSubview:outView with:inView];
    }
    [CATransaction commit];
  } else {
    [outView viewWillDisappear:animated];
    [inView viewWillAppear:animated];
    
    [self.view replaceSubview:outView with:inView];
    
    [inView viewDidAppear:animated];
    [outView viewDidDisappear:animated];
  }
}

@end