//
//  KBTitleView.h
//  Keybase
//
//  Created by Gabriel on 3/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import "KBButton.h"
#import "KBNavigationView.h"
#import "KBLabel.h"

@interface KBTitleView : YOView

@property (readonly) KBLabel *label;
@property CGFloat height;

+ (instancetype)titleViewWithTitle:(NSString *)title;

- (void)setTitle:(NSString *)title;

@end
