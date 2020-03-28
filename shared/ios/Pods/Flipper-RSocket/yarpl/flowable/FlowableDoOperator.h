// Copyright (c) Facebook, Inc. and its affiliates.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#pragma once

#include "yarpl/flowable/FlowableOperator.h"

namespace yarpl {
namespace flowable {
namespace details {

template <
    typename U,
    typename OnSubscribeFunc,
    typename OnNextFunc,
    typename OnErrorFunc,
    typename OnCompleteFunc,
    typename OnRequestFunc,
    typename OnCancelFunc>
class DoOperator : public FlowableOperator<U, U> {
  using Super = FlowableOperator<U, U>;
  static_assert(
      std::is_same<std::decay_t<OnSubscribeFunc>, OnSubscribeFunc>::value,
      "undecayed");
  static_assert(
      std::is_same<std::decay_t<OnNextFunc>, OnNextFunc>::value,
      "undecayed");
  static_assert(
      std::is_same<std::decay_t<OnErrorFunc>, OnErrorFunc>::value,
      "undecayed");
  static_assert(
      std::is_same<std::decay_t<OnCompleteFunc>, OnCompleteFunc>::value,
      "undecayed");
  static_assert(
      std::is_same<std::decay_t<OnRequestFunc>, OnRequestFunc>::value,
      "undecayed");
  static_assert(
      std::is_same<std::decay_t<OnCancelFunc>, OnCancelFunc>::value,
      "undecayed");

 public:
  template <
      typename FSubscribe,
      typename FNext,
      typename FError,
      typename FComplete,
      typename FRequest,
      typename FCancel>
  DoOperator(
      std::shared_ptr<Flowable<U>> upstream,
      FSubscribe&& onSubscribeFunc,
      FNext&& onNextFunc,
      FError&& onErrorFunc,
      FComplete&& onCompleteFunc,
      FRequest&& onRequestFunc,
      FCancel&& onCancelFunc)
      : upstream_(std::move(upstream)),
        onSubscribeFunc_(std::forward<FSubscribe>(onSubscribeFunc)),
        onNextFunc_(std::forward<FNext>(onNextFunc)),
        onErrorFunc_(std::forward<FError>(onErrorFunc)),
        onCompleteFunc_(std::forward<FComplete>(onCompleteFunc)),
        onRequestFunc_(std::forward<FRequest>(onRequestFunc)),
        onCancelFunc_(std::forward<FCancel>(onCancelFunc)) {}

  void subscribe(std::shared_ptr<Subscriber<U>> subscriber) override {
    auto subscription = std::make_shared<DoSubscription>(
        this->ref_from_this(this), std::move(subscriber));
    upstream_->subscribe(
        // Note: implicit cast to a reference to a subscriber.
        subscription);
  }

 private:
  class DoSubscription : public Super::Subscription {
    using SuperSub = typename Super::Subscription;

   public:
    DoSubscription(
        std::shared_ptr<DoOperator> flowable,
        std::shared_ptr<Subscriber<U>> subscriber)
        : SuperSub(std::move(subscriber)), flowable_(std::move(flowable)) {}

    void onSubscribeImpl() override {
      flowable_->onSubscribeFunc_();
      SuperSub::onSubscribeImpl();
    }

    void onNextImpl(U value) override {
      const auto& valueRef = value;
      flowable_->onNextFunc_(valueRef);
      SuperSub::subscriberOnNext(std::move(value));
    }

    void onErrorImpl(folly::exception_wrapper ex) override {
      const auto& exRef = ex;
      flowable_->onErrorFunc_(exRef);
      SuperSub::onErrorImpl(std::move(ex));
    }

    void onCompleteImpl() override {
      flowable_->onCompleteFunc_();
      SuperSub::onCompleteImpl();
    }

    void cancel() override {
      flowable_->onCancelFunc_();
      SuperSub::cancel();
    }

    void request(int64_t n) override {
      flowable_->onRequestFunc_(n);
      SuperSub::request(n);
    }

    void onTerminateImpl() override {
      flowable_.reset();
      SuperSub::onTerminateImpl();
    }

   private:
    std::shared_ptr<DoOperator> flowable_;
  };

  std::shared_ptr<Flowable<U>> upstream_;
  OnSubscribeFunc onSubscribeFunc_;
  OnNextFunc onNextFunc_;
  OnErrorFunc onErrorFunc_;
  OnCompleteFunc onCompleteFunc_;
  OnRequestFunc onRequestFunc_;
  OnCancelFunc onCancelFunc_;
};

template <
    typename U,
    typename OnSubscribeFunc,
    typename OnNextFunc,
    typename OnErrorFunc,
    typename OnCompleteFunc,
    typename OnRequestFunc,
    typename OnCancelFunc>
inline auto createDoOperator(
    std::shared_ptr<Flowable<U>> upstream,
    OnSubscribeFunc&& onSubscribeFunc,
    OnNextFunc&& onNextFunc,
    OnErrorFunc&& onErrorFunc,
    OnCompleteFunc&& onCompleteFunc,
    OnRequestFunc&& onRequestFunc,
    OnCancelFunc&& onCancelFunc) {
  return std::make_shared<DoOperator<
      U,
      std::decay_t<OnSubscribeFunc>,
      std::decay_t<OnNextFunc>,
      std::decay_t<OnErrorFunc>,
      std::decay_t<OnCompleteFunc>,
      std::decay_t<OnRequestFunc>,
      std::decay_t<OnCancelFunc>>>(
      std::move(upstream),
      std::forward<OnSubscribeFunc>(onSubscribeFunc),
      std::forward<OnNextFunc>(onNextFunc),
      std::forward<OnErrorFunc>(onErrorFunc),
      std::forward<OnCompleteFunc>(onCompleteFunc),
      std::forward<OnRequestFunc>(onRequestFunc),
      std::forward<OnCancelFunc>(onCancelFunc));
}
} // namespace details
} // namespace flowable
} // namespace yarpl
