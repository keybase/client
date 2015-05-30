//
//  KBSecretWordsInputView.h
//  Keybase
//
//  Created by Gabriel on 3/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "KBAppDefines.h"
#import "KBContentView.h"

typedef void (^KBDeviceAddCompletion)(BOOL ok);

@interface KBDeviceAddView : KBContentView

@property (readonly) KBTextView *inputField;
@property (copy) KBDeviceAddCompletion completion;
@property KBButton *cancelButton;

@end
