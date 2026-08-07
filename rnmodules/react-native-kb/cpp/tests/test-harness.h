// Minimal assert/report harness. No gtest/catch2 dependency so the test
// binary stays buildable with the same plain clang++ invocation already used
// for syntax-checking react-native-kb.cpp.
#pragma once

#include <exception>
#include <functional>
#include <iostream>
#include <string>
#include <vector>

namespace kbtest {

struct Failure {
  std::string message;
};

// Thrown by CHECK/CHECK_EQ on failure; caught by the runner per test case.
struct CheckFailed : std::exception {
  std::string message;
  explicit CheckFailed(std::string m) : message(std::move(m)) {}
  const char *what() const noexcept override { return message.c_str(); }
};

inline void check(bool cond, const std::string &msg, const char *file,
                  int line) {
  if (!cond) {
    throw CheckFailed(std::string(file) + ":" + std::to_string(line) + ": " +
                      msg);
  }
}

#define CHECK(cond)                                                          \
  ::kbtest::check((cond), "CHECK failed: " #cond, __FILE__, __LINE__)
#define CHECK_MSG(cond, msg)                                                  \
  ::kbtest::check((cond), (msg), __FILE__, __LINE__)

template <typename A, typename B>
void checkEq(const A &a, const B &b, const char *aExpr, const char *bExpr,
            const char *file, int line) {
  if (!(a == b)) {
    throw CheckFailed(std::string(file) + ":" + std::to_string(line) +
                      ": CHECK_EQ failed: " + aExpr + " (" +
                      std::to_string(a) + ") != " + bExpr + " (" +
                      std::to_string(b) + ")");
  }
}

#define CHECK_EQ(a, b)                                                       \
  ::kbtest::checkEq((a), (b), #a, #b, __FILE__, __LINE__)

class Runner {
public:
  void add(std::string name, std::function<void()> fn) {
    cases_.push_back({std::move(name), std::move(fn)});
  }

  // Returns 0 if every case passed, 1 otherwise. Prints PASS/FAIL per case
  // and a final summary.
  int run() {
    int failed = 0;
    for (auto &c : cases_) {
      try {
        c.fn();
        std::cout << "[PASS] " << c.name << "\n";
      } catch (const std::exception &e) {
        ++failed;
        std::cout << "[FAIL] " << c.name << ": " << e.what() << "\n";
      } catch (...) {
        ++failed;
        std::cout << "[FAIL] " << c.name << ": unknown exception\n";
      }
    }
    std::cout << (cases_.size() - failed) << "/" << cases_.size()
              << " passed\n";
    return failed == 0 ? 0 : 1;
  }

private:
  struct Case {
    std::string name;
    std::function<void()> fn;
  };
  std::vector<Case> cases_;
};

} // namespace kbtest
