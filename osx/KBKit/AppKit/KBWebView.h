//
//  KBWebView.h
//  Keybase
//
//  Created by Gabriel on 1/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import <WebKit/WebKit.h>

@interface KBWebView : YOView

- (void)openURLString:(NSString *)URLString;

@end
