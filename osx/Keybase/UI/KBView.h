//
//  KBView.h
//  Keybase
//
//  Created by Gabriel on 3/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import "KBNavigationView.h"

@interface KBView : YONSView

@property KBNavigationView *navigation;

// Optional content view created on access
@property (nonatomic, readonly) YONSView *contentView;

@end
