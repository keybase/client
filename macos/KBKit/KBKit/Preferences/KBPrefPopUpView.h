//
//  KBPrefPopUpView.h
//  Keybase
//
//  Created by Gabriel on 4/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBPreferences.h"
#import <YOLayout/YOLayout.h>

@interface KBPrefPopUpView : YOView

@property CGFloat inset;
@property CGFloat labelWidth;
@property CGFloat fieldWidth;

- (void)setLabelText:(NSString *)labelText options:(NSArray */*of KBPrefOption*/)options identifier:(NSString *)identifier preferences:(id<KBPreferences>)preferences;

@end
