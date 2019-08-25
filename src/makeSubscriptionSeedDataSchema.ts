import {GraphQLSchema} from "graphql";
import {addMockFunctionsToSchema, makeExecutableSchema, IMocks} from "graphql-tools";
import {gql} from "apollo-server-core";
import {FakedScalar, FakedList} from "./Directives";


// In order to implement morphing subscriptions
export function makeSubscriptionSeedDataSchema(schemaText: string): [GraphQLSchema, GraphQLSchema] {

    const schema = makeExecutableSchema({
        typeDefs: gql(schemaText), resolvers: {}, schemaDirectives: {
            fake: FakedScalar,
            fake_list: FakedList
        }
    });


    const tx = schemaText
        .replace(/type Query/, "type QueryX")
        .replace(/type Subscription/, "type Query");


    const seedSchema = makeExecutableSchema({
        typeDefs: gql(tx), resolvers: {}, schemaDirectives: {
            fake: FakedScalar,
            fake_list: FakedList
        }
    });

    const mocks: IMocks = {};

    for (const type in FakedList.mockListTypes) {
        mocks[type] = () => FakedList.mockListTypes[type];
    }

    addMockFunctionsToSchema({schema, mocks, preserveResolvers: true});
    addMockFunctionsToSchema({schema: seedSchema, mocks, preserveResolvers: true});

    return [schema, seedSchema];
}
