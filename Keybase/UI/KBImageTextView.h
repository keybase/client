//
//  KBImageTextView.h
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

@interface KBImageTextView : YONSView

- (void)setTitle:(NSString *)title description:(NSString *)description imageSource:(NSString *)imageSource;

@end
