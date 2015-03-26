//
//  KBTextView.h
//  Keybase
//
//  Created by Gabriel on 2/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

@interface KBTextView : YOView <NSTextViewDelegate>

@property (readonly) NSTextView *textView;
@property (nonatomic) NSAttributedString *attributedText;
@property (nonatomic) NSString *text;

@end
