//
//  KBSecretWordsInputView.h
//  Keybase
//
//  Created by Gabriel on 3/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "KBAppKit.h"
#import "KBContentView.h"

typedef void (^KBSecretWordsCompletion)(NSString *secretWords);

@interface KBSecretWordsInputView : KBContentView

@property (readonly) KBTextField *inputField;
@property (copy) KBSecretWordsCompletion completion;
@property KBButton *cancelButton;

@end
