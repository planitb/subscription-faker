# Subscription Faker

A GraphQL server implementing "faked" GraphQL queries, mutations *and* subscriptions. You supply the (annotated) schema, this server generates your test data.

The faked data is configured using the special GraphQL schema directives `@fake` and `@fake_list` (see *Usage* below). The server implements a *hot schema reload* mechanism whereby schema changes take effect without the server needing to be restarted.

Subscription-faker differs from other GraphQL fakers in that it supports subscriptions as well as queries and mutations. When a subscription is initiated, data is faked as though it were generated with a query - updates are published by successively "morphing" the original data according to probabilities specified in the `@fake()` and `@fake_list()` directives in the schema. This emulates datasets being modified over time in a multi-user system. In turn, this can be handy for testing how your client responds to updates.

## Installation

```bash
npm install subscription-faker
```
## Usage

If installed with the optional `-g` flag the server can be started using the `subscription-faker` command. If installed locally (without the `-g` flag) it will need to be started using `npx subscription-faker`.

### Command Line Options

```
Usage: main [options]

Options:
  -V, --version          output the version number
  -s, --schema <file>    Annotated GraphQL schema file (default: "schema.graphql")
  -h, --host <hostname>  Hostname or IP address to run server under (default: "localhost")
  -p, --port <number>    port number to run the server under (default: 4000)
  -u, --pathname <path>  The server pathname (default: "/graphql")
  -c, --period <period>  The update cycle period (in seconds) for subscriptions (default: 1)
  -v, --verbose          Echo generated data to stdout (default: false)
  -h, --help             output usage information
```

### The `@fake()` schema directive
```graphql
directive @fake(
    fake: String,                   # a JavaScript expression
    probability: Float = 0,         # 0.0 => never morphs, 1.0 => always morphs
) on FIELD_DEFINITION
```

The `@fake()` directive can be meaningfully applied to any scalar GraphQL field. The `fake` property of the directive should be a valid JavaScript expression; this will be evaluated and the resultant value assigned to the given datum. Within the expression, `this` references an instance of `faker`, see [https://www.npmjs.com/package/faker](https://www.npmjs.com/package/faker) for details of the `faker` API. See also the examples below. If no `@fake()` is associated with a scalar, the default value from the Apollo GraphQL server will be used (see [https://www.apollographql.com/docs/apollo-server/features/mocking/](https://www.apollographql.com/docs/apollo-server/features/mocking/) for more details).

The optional `@fake()` `probability` controls how the data changes if that field is returned by a GraphQL subscription. It should range from 0 (the data never changes - the default) to 1 (the data changes every subscription cycle). If the `probability` is set to 0.5, then on each subscription cycle there is a 50% probability that the data will be updated. The new, fake, data is regenerated using the original `fake` expression.

### The `@fake_list()` schema directive
```graphql
directive @fake_list(
    min: Int
    max: Int
    p_add: Float
    p_delete: Float
) on FIELD_DEFINITION
```

The `fake_list()` directive can be meaningfully attached to any GraphQL list. The `min` and `max` properties specify the minimum and maximum list lengths that should be generated; a random length will be chosen at run time.

The `p_add` and `p_delete` properties control how the list changes if it is returned as part of a GraphQL subscription. These probabilities (again ranging from 0 to 1) control how likely an element will be randomly added to the list or removed. The length of the list will not fall below the specified `min` or exceed the specified `max` - if it were to do so the update will be ignored.

## Example

```graphql
type Course {
    title: String           @fake(fake: "this.lorem.words()")
    author: String          @fake(fake: "this.name.findName()")
    description: String     
    url: String             @fake(fake: "this.internet.url()", probability: 0.1)
    sections: [Section]     @fake_list(min: 3, max: 7, p_add: 0.2, p_delete: 0.3)
    size: Int               @fake(fake: "this.random.number(100)", probability: 0.5)
}
```

Defines a GraphQL type called `Course`. When queried, subscribed to or returned from a mutation:

- The `title` property will be generated using the [lorem/words](http://marak.github.io/faker.js/faker.lorem.html#-static-words__anchor) method in the `faker` library.
- The `author` property will be generated with the `faker` [name/findName](http://marak.github.io/faker.js/faker.name.html#-static-findName__anchor) method.
- The `description` property will fallback to the default mock value specified by the Apollo server.
- The `url` property will be generated with the `faker` [internet/url](http://marak.github.io/faker.js/faker.internet.html#-static-url__anchor) method.
- The `sections` property will be generated with a randomly selected length of between 3 and 7 elements inclusive. Furthermore, on each subscription cycle there will be a 20% probability that a new element will be added (at a random location along the list) and a 30% probability that a randomly selected element will be removed. However, the list will always have at least 3 elements and never more than 7.
- Finally, the `size` property will be generated as a random number between 0 and 100 using [random/number](http://marak.github.io/faker.js/faker.random.html#-static-number__anchor) - illustrating that parameters can be passed into `faker` functions. On each subscription cycle there is a 50% probability that the number will be re-generated. 

## Support
Please raise issues on Github.

## Contributing
Github pull requests are very welcome.

## License

MIT

## Project Status

Always interested in fault reports and enhancement suggestions.
