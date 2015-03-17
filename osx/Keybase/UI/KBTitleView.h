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
#import "KBMenuBar.h"

@interface KBTitleView : YOView

@property (nonatomic) NSString *title;

+ (instancetype)titleViewWithTitle:(NSString *)title;

@end
