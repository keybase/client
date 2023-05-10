// This guard prevent this file to be compiled in the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>

#ifndef PasteInputViewNativeComponent_h
#define PasteInputViewNativeComponent_h

NS_ASSUME_NONNULL_BEGIN

@interface PasteInputView : RCTViewComponentView
@end

NS_ASSUME_NONNULL_END

#endif /* PasteInputViewNativeComponent_h */
#endif /* RCT_NEW_ARCH_ENABLED */
