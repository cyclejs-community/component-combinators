
# Testing strategy
Given the large size (infinite) of the domain of the function under test, the following
hypothesis based on the knowledge of the implementation (gray-box testing) will be used to reduce when deemed convenient the size of the test space :

T1 : Independence hypothesis
:    Testing against A | B is sufficient to guarantee behaviour on A x B (independence of A and B)

T2 : Continuity hypothesis
:    When we have to test against a set of possible values, we will only test the limit
conditions, assuming that passing those tests implies a correct behaviour for the other values.

T3 : Generating set hypothesis
:    When we are confident that a smaller test set is sufficient to imply the expected
behaviour for the whole set, we will test only against that smaller test.

T4 : HC/LB faith hypothesis
:    In some cases we simply renounce to test against some values of the test space (80-20 Pareto approach, where we discard the 20% of tests which are high cost and low benefit). This may happen when the values to be tested against are :

- believed to lead to correct behaviour of the function under test (faith)
- believed to have a sufficient low probability of occuring/have an impact that we are willing to absorb
