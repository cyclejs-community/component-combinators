import * as QUnit from "qunitjs"
import { map, reduce, always, clone, curry, identity, flatten, match, T, F, __ } from "ramda"
import * as Rx from "rx"
import { decorateWithOne, makeFunctionDecorator, decorateWith } from "../src/utils"

let $ = Rx.Observable;

QUnit.module("utils");

QUnit.test(
  "makeFunctionDecorator :: ({ before, after, name }) : o after, x before, o name",
  function exec_test(assert) {

    function tapEventSource(eventName) {
      return function (result) {
        return result.tap(_ => {
          testArr.push(`value: ${_}`);
          return testArr;
        })
      }
    }

    function tapStreamOutput(eventName) {
      return makeFunctionDecorator({ after: tapEventSource(eventName), name: 'tapStreamOutput' })
    }

    const decoratorFn = tapStreamOutput('testEv');
    const testArr = [];
    const fnToDecorate = function testFn(param) {
      return $.just(param)
    };

    assert.ok(typeof decoratorFn === 'function', `makeFunctionDecorator returns a function`);
    const args = ['params'];
    const result = decoratorFn(args, 'testFn', fnToDecorate);
    result.subscribe((value) => {
      assert.deepEqual(`${args[0]}`, value, `the decorated function is executed!`)
    });
    assert.deepEqual(testArr, [`value: ${args[0]}`], `the (after) decorating function is executed on the result of the decorated function!`);
  });

QUnit.test(
  "makeFunctionDecorator :: ({ before, after, name }) : x after, o before, o name",
  function exec_test(assert) {

    const log = curry(function log(specs, args, fnToDecorateName, fnToDecorate) {
      specs.forEach((x, i) => {
        testArr.push(`${x} : ${[args, fnToDecorateName, fnToDecorate][i]}`)
      })
    });
    const specs = ['args', 'fnToDecorateName', 'fnToDecorate'];

    const decoratorFn = makeFunctionDecorator({ before: log(specs), name: 'log' });
    const testArr = [];
    const fnToDecorate = function testFn(param) {
      return $.just(param)
    };

    assert.ok(typeof decoratorFn === 'function', `makeFunctionDecorator returns a function`);
    const args = ['params'];
    const result = decoratorFn(args, 'testFn', fnToDecorate);
    result.subscribe((value) => {
      assert.deepEqual(`${args[0]}`, value, `the decorated function is executed!`)
    });
    assert.deepEqual(testArr, [
      "args : params",
      "fnToDecorateName : testFn",
      `fnToDecorate : function testFn(param) {
    return $.just(param);
  }`,
    ], `the (after) decorating function is executed on the result of the decorated function!`);
  });

QUnit.test(
  "decorateWithOne:: decoratingFnSpecs, fnToDecorate",
  function exec_test(assert) {
    const log = curry(function log(specs, args, fnToDecorateName, fnToDecorate) {
      specs.forEach((x, i) => {
        testArr.push(`${x} : ${[args, fnToDecorateName, fnToDecorate][i]}`)
      })
    });
    const specs = ['param'];
    const eventName = 'testEv';

    function tapEventSource(eventName) {
      return function (result, fnToDecorateName,fnToDecorate) {
        return result.tap(_ => {
          testArr.push(`value: ${_}`);
        })
      }
    }

    function tapStreamOutput(eventName) {
      return makeFunctionDecorator({ after: tapEventSource(eventName), name: 'tapStreamOutput' })
    }

    const testArr = [];
    const fnToDecorate = function testFn(param) {
      return $.just(param + '!')
    };
    const decoratedFn = decorateWithOne({
      before: log(specs),
      after: tapEventSource(eventName)
    }, fnToDecorate);

    assert.ok(typeof decoratedFn === 'function', `decorateWithOne returns a function`);
    const result = decoratedFn('paramTest');
    result.subscribe((value) => {
      assert.deepEqual(`paramTest!`, value, `the decorated function is executed!`)
    });
    assert.deepEqual(testArr, ["param : paramTest", "value: paramTest!"],
      `the decorated function executes normally together with its decoration`);

  });

QUnit.test(
  "decorateWith:: [decoratingFnSpecs], fnToDecorate",
  function exec_test(assert) {
    const log = curry(function log(specs, args, fnToDecorateName, fnToDecorate) {
      specs.forEach((x, i) => {
        testArr.push(`${x} : ${[args, fnToDecorateName, fnToDecorate][i]}`)
      })
    });
    const specs = ['param'];
    const eventName = 'testEv';

    function tapEventSource(eventName) {
      return function (result) {
        return result.tap(_ => {
          testArr.push(`value: ${_}`);
        })
      }
    }

    function tapStreamOutput(eventName) {
      return makeFunctionDecorator({ after: tapEventSource(eventName), name: 'tapStreamOutput' })
    }

    const testArr = [];
    const fnToDecorate = function testFn(param) {
      return $.just(param + '!')
    };
    const decoratedFn = decorateWith([
      { before: log(specs) },
      { after: tapEventSource(eventName) }
    ], fnToDecorate);

    assert.ok(typeof decoratedFn === 'function', `decorateWithOne returns a function`);
    const result = decoratedFn('paramTest');
    result.subscribe((value) => {
      assert.deepEqual(`paramTest!`, value, `the decorated function is executed!`)
    });
    assert.deepEqual(testArr, ["param : paramTest", "value: paramTest!"],
      `the decorated function executes normally together with its decoration`);

  });
