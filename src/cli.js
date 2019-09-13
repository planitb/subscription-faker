#!/usr/bin/env node

const main = require("./main").main;
const program = require("commander");

program
    .version("0.1.0")
    .usage("[options]")
    .option("-s, --schema <file>", "Annotated GraphQL schema file", "schema.graphql")
    .option("-h, --host <hostname>", "Hostname or IP address to run server under", "localhost")
    .option("-p, --port <number>", "port number to run the server under", 4000)
    .option("-u, --pathname <path>", "The server pathname", "/graphql")
    .option("-c, --period <period>", "The update cycle period (in seconds) for subscriptions", 1)
    .option("-v, --verbose", "Echo generated data to stdout", false)
    .parse(process.argv);

main(program).then();
