//
//  KBSecretPromptView.h
//  Keybase
//
//  Created by Gabriel on 6/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>

typedef void (^KBSecretPromptCompletion)(NSString *secret);

@interface KBSecretPromptView : YOView

@property (copy) KBSecretPromptCompletion completion;

- (void)setHeader:(NSString *)header info:(NSString *)info details:(NSString *)details previousError:(NSString *)previousError;

- (KBWindow *)openInWindow:(KBWindow *)window;

@end
