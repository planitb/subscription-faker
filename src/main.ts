import { gql, PubSub } from "apollo-server";
import { ApolloServer } from "apollo-server-express";
import {makeSubscriptionSeedDataSchema} from "./makeSubscriptionSeedDataSchema";
import {ExecutionResult, FieldNode, graphql, GraphQLSchema, OperationDefinitionNode} from "graphql";
import {convertToObject} from "./utils";
import { delegateToSchema } from 'graphql-tools'
import express, {Express} from "express";
import http, {IncomingMessage, ServerResponse} from "http";
import {PubSubWrapper} from "./PubSubWrapper";
import {AddressInfo} from "net";
import * as WebSocket from "ws";
import * as fs from "fs";
import {watch} from "chokidar";
import { SubscriptionServer } from "subscriptions-transport-ws";
import { execute, subscribe } from "graphql";
import program from "commander";


/*
The Objective: support faked, morphing subscriptions. "Faked" as in the data is all generated on-the-fly and "morphing"
as in subscribed data morphs (changes) slightly on each subscription update.

Implementation overview: GraphQL directives (https://www.apollographql.com/docs/apollo-server/features/directives/) are
used to annotate the GraphQL schema with faking and morphing directives. Faking is managed by a combination of Apollo's
inbuilt mocking and two additional directive classes: FakedScalar and FakedList. Both implement their behaviour by
installing bespoke resolver functionality. FakedScalar uses the Faker package (
https://www.npmjs.com/package/faker) under the control of the "fake" directive to generate appropriate scalar values.
FakedList generates random length lists of GraphQL types as specified by the "fake_list" directive.

Morphing of data is controlled by the optional "probability" on the "fake" directive and the optional "p_add" and
"p_delete" properties on the "fake_list" directive. When the resolvers first fire they create instances of MorphScalar,
ListAddElementMorph and ListDeleteElementMorph as appropriate. These instances inherit from the Morph base class which
maintains a map of (derived) Morph instances indexed by name. The Morph class implements a static method, cycle(), which
runs through the Morph instance map, deciding if they trigger and then executing them. Each morph has a JsonPath that
is used to "query" the morphing data instance to locate the set of objects corresponding to the appropriate location in
the schema. Each such instance is then morphed if it is randomly triggered - which is a function of its associated
probability.

Morphing of scalars simply re-invokes the faker associated with the field. Morphing list deletions simply deletes a
random list element. Extending a list is more tricky since it needs to fake new list elements. To do this,
ListAddElementMorph is supplied a data generation function which executes the original subscription query and then
selectively copies elements from the newly generated list into the morphing data.

Subscriptions are awkward because the initial subscription data needs to ge generated somehow. Unfortunately, GraphQL
treats subscriptions and queries completely separately - you can't just change "subscription" to "query". To get
around this wrinkle I create *two* GraphQL schemas, one as specified by the user and the second with the "Query" type
changed to junk and "Subscription" changed to "Query". So, on a subscription I do a Query against the second schema to
generate the initial data.

The final awkwardness relate to schema updates. I don't want the server to need restarting every time the user updates
the schema ... so I watch the schema file and update the server. This was surprisingly difficult to arrange ... in the
end I create a new HTTP server and switch it's request handler to newly created express instances.

Enjoy!
 */


export interface SubscriptionFakerOptions {
    schema: string;
    host: string;
    port: number;
    pathname: string;
    period: number;
    verbose: boolean;
}


function topLevelQueryDelegate(fieldName: string, schema: GraphQLSchema): any {
    return (parent: any, args: any, context: any, info: any) => {
        context['originalQuery'] = info.operation.loc.source.body;
        return delegateToSchema({
            schema,
            operation: 'query',
            fieldName,
            context,
            info
        });
    }
}


async function createApolloServer(schemaText: string, graphQLPath: string, app: Express, period: number): Promise<[ApolloServer, PubSubWrapper, GraphQLSchema]> {
    const [schema, seedSchema] = makeSubscriptionSeedDataSchema(schemaText);
    const pubsub: PubSubWrapper = new PubSubWrapper(new PubSub(), seedSchema, period);
    const schemaQuery = `
        query {
          __schema {
            queryType {
              fields {
                name
              }
            }
          }
        }
    `;

    const {queryType} = convertToObject(await graphql(schema, schemaQuery)).data.__schema;
    const resolvers: any = {
        Query: {},
        Subscription: {}
    };

    queryType.fields.map((f: any) => f.name).forEach((f: string) => resolvers.Query[f] = topLevelQueryDelegate(f, schema));

    const apollo = new ApolloServer({
        typeDefs: gql(schemaText),
        resolvers
    });

    apollo.setGraphQLPath(graphQLPath);
    apollo.applyMiddleware({app});

    return [apollo, pubsub, schema];
}


interface DynamicSubscriptionConfig {
    pubsub?: PubSubWrapper;
    schema?: GraphQLSchema;
}


function createSubscriptionServer(wsServer: WebSocket.Server, config: DynamicSubscriptionConfig, verbose: boolean): SubscriptionServer {
    return new SubscriptionServer({
        onOperation() {
            return {schema: config.schema};
        },
        execute(...args) {
            return execute(...args);
        },
        async subscribe(schema, document, ...args) {
            if ( document.loc && config.pubsub ) {
                const query = document.loc.source.body.replace(/subscription/, "query");
                const node = document.definitions[0] as OperationDefinitionNode;
                const selectionNode = node.selectionSet.selections[0] as FieldNode;
                const fieldName = selectionNode.name.value;
                const pubsub = config.pubsub;
                const seed = await pubsub.ensurePublishing(query, fieldName);

                if ( verbose ) {
                    console.clear();
                    console.dir(seed, {depth: null});

                    const _subId = await pubsub.subscribe(fieldName, (m: any) => {
                        console.clear();
                        console.dir(m, {depth: null});
                    }, {});
                }

                return pubsub.asyncIterator<ExecutionResult>(fieldName);
            }
            return subscribe(schema, document, ...args);
        }
    }, wsServer);
}


async function fileChanged(fileName: string): Promise<boolean> {
    const watcher = watch(fileName);

    return new Promise(resolve => {
        watcher.once("change", () => {
            resolve(true);
        });
    });
}


export async function main(options: SubscriptionFakerOptions) {
    const {pathname, port, host, period, verbose} = options;
    let app: Express;
    let wsServer: WebSocket.Server;

    function delegateToExpress(req: IncomingMessage, res: ServerResponse) {
        if ( app ) {
            app(req, res);
        } else {
            console.error("Missing middleware");
        }
    }

    const server = http.createServer(delegateToExpress);

    server.listen({port, host}, async () => {
        const a = server.address() as AddressInfo;

        console.log(`🚀 Server ready at http://${a.address}:${a.port}${pathname}`);

        wsServer = new WebSocket.Server({server, path: pathname});

        let apollo: ApolloServer | null = null;
        let pubsub: PubSubWrapper | null = null;
        const subscriptionConfig: DynamicSubscriptionConfig = {};

        createSubscriptionServer(wsServer, subscriptionConfig, verbose);

        do {
            const newMiddleware = express();

            if (apollo) {
                await apollo.stop();

                if ( options.verbose ) {
                    console.log("Schema updated");
                }
            }

            if (pubsub) {
                pubsub.unsubscribeAll();
            }

            const r = await createApolloServer(fs.readFileSync(options.schema).toString(), pathname, newMiddleware, period);

            apollo = r[0];
            pubsub = r[1];
            const schema = r[2];

            app = newMiddleware;

            subscriptionConfig.pubsub = pubsub;
            subscriptionConfig.schema = schema;

        } while (await fileChanged(options.schema));
    });
}

require('source-map-support').install();


if (require.main === module) {

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

    main(program as unknown as SubscriptionFakerOptions).then();
}


