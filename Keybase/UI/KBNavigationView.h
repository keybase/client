//
//  KBNavigationView.h
//  Keybase
//
//  Created by Gabriel on 1/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBView.h"

typedef NS_ENUM (NSInteger, KBNavigationTransitionType) {
  KBNavigationTransitionTypeNone,
  KBNavigationTransitionTypePush,
  KBNavigationTransitionTypePop,
  KBNavigationTransitionTypeFade
};

@class KBNavigationView;

@protocol KBNavigationTitleView <NSObject>
- (void)setTitle:(NSString *)title;
- (void)setProgressEnabled:(BOOL)progressEnabled;
- (void)navigationView:(KBNavigationView *)navigationView willTransitionView:(NSView *)view transitionType:(KBNavigationTransitionType)transitionType;
@end

@interface KBNavigationView : KBView

@property (nonatomic) NSView<KBNavigationTitleView> *titleView;
@property (readonly) NSMutableArray *views; // Fix mutable

- (instancetype)initWithView:(NSView *)view;

- (void)pushView:(NSView *)view animated:(BOOL)animated;

- (void)popViewAnimated:(BOOL)animated;

- (void)swapView:(NSView *)view animated:(BOOL)animated;

- (void)setView:(NSView *)view transitionType:(KBNavigationTransitionType)transitionType;

@end
