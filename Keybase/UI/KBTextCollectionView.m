//
//  KBTextCollectionView.m
//  Keybase
//
//  Created by Gabriel on 2/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTextCollectionView.h"

#import "KBTextView.h"

@implementation KBTextCollectionView

- (void)viewInit {
  [super viewInit];
  self.prototypeClass = KBTextView.class;
}

- (void)updateView:(KBTextView *)view object:(NSString *)object {
  [view setText:object font:[NSFont systemFontOfSize:14] color:[NSColor blackColor] alignment:NSLeftTextAlignment];
}

- (void)select:(id)object {

}

@end
