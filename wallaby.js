
module.exports = function () {
    'use strict';

    return {
        files: ['src/*.ts'],
        tests: ['tests/*Spec.ts'],
        debug: true,
        testFramework: 'jasmine',
        env: {type: 'node', runner: 'node'},
        maxConsoleMessagesPerTest: 10000,

        workers: {
            initial: 1,
            regular: 1
        }
    };
};
