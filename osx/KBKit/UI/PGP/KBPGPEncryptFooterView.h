//
//  KBPGPEncryptFooterView.h
//  Keybase
//
//  Created by Gabriel on 3/25/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>

@interface KBPGPEncryptFooterView : YOVBox

@property KBButton *signButton;
@property KBButton *includeSelfButton;
@property KBButton *encryptButton;
@property KBButton *cancelButton;

@end


@interface KBPGPEncryptToolbarFooterView : YOVBox

@property KBButton *signButton;
@property KBButton *includeSelfButton;
@property KBButton *encryptButton;
@property KBButton *cancelButton;

@end