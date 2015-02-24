//
//  KBImageTextView.h
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import "KBImageView.h"
#import "KBLabel.h"
#import "KBBox.h"
#import "KBAppearance.h"

@interface KBImageTextView : YONSView

@property (readonly) KBImageView *imageView;
@property (readonly) KBLabel *titleLabel;
@property (readonly) KBLabel *descriptionLabel;
@property (readonly) KBBox *border;

@property CGSize imageSize;

- (void)setTitle:(NSString *)title description:(NSString *)description imageSource:(NSString *)imageSource;

@end
