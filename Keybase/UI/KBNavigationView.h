//
//  KBNavigationView.h
//  Keybase
//
//  Created by Gabriel on 1/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"

typedef NS_ENUM (NSInteger, KBNavigationTransitionType) {
  KBNavigationTransitionTypeNone,
  KBNavigationTransitionTypePush,
  KBNavigationTransitionTypePop,
  KBNavigationTransitionTypeFade
};

@class KBNavigationView;

@protocol KBNavigationViewDelegate <NSObject>
- (void)navigationView:(KBNavigationView *)navigationView willTransitionView:(NSView *)view transitionType:(KBNavigationTransitionType)transitionType;
@end

@interface KBNavigationView : KBView

@property (nonatomic) NSView<KBNavigationViewDelegate> *titleView;
@property (weak) id<KBNavigationViewDelegate> delegate;
@property (readonly) NSMutableArray *views; // Fix mutable

- (void)pushView:(NSView *)view animated:(BOOL)animated;

- (void)popViewAnimated:(BOOL)animated;

- (void)swapView:(NSView *)view animated:(BOOL)animated;

- (void)setView:(NSView *)view transitionType:(KBNavigationTransitionType)transitionType;

@end
