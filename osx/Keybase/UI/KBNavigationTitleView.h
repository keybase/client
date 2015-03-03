//
//  KBNavigationTitleView.h
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import "KBButton.h"
#import "KBNavigationView.h"
#import "KBMenuBar.h"

@interface KBNavigationTitleView : YONSView <KBNavigationTitleView>

//@property KBButton *backView;
@property (weak) KBNavigationView *navigation;

//@property KBMenuBar *menuBar;
@property (nonatomic) NSString *title;

+ (instancetype)titleViewWithTitle:(NSString *)title navigation:(KBNavigationView *)navigation;

@end
