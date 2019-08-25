import {MockList, SchemaDirectiveVisitor} from "graphql-tools";
import {
    graphql,
    GraphQLField,
    GraphQLInterfaceType,
    GraphQLObjectType,
    GraphQLResolveInfo
} from "graphql";
import * as Faker from "faker";
import {MorphScalar, ListAddElementMorph, ListDeleteElementMorph, Morph} from "./Morphs";
import {Path} from "graphql/jsutils/Path";
import {convertToObject} from "./utils";


function wildJsonPath(path: Path | void, root = "$"): string {
    if ( !path ) {
        return "";
    }

    return root + wildJsonPath(path.prev, "") + ( isNaN(+path.key) ? "." + path.key : "[*]" );
}


export class FakedScalar extends SchemaDirectiveVisitor {
    public visitFieldDefinition(field: GraphQLField<any, any>): GraphQLField<any, any> | void | null {
        const fakerCall = new Function("return " + this.args.fake);
        const {probability} = this.args;

        field.resolve = async function (source, args, context, info: GraphQLResolveInfo) {
            if ( probability ) {
                const property = info.path.key.toString();
                let path = info.path.prev;

                if (!path) {
                    throw Error("Missing resolver path");
                }

                // the "name" includes the leaf property, but the "path" references only the enclosing object
                new MorphScalar(probability, wildJsonPath(info.path), wildJsonPath(path), async (s: Record<string, any>) => {
                    s[property] = await fakerCall.call(Faker);
                });
            }

            return fakerCall.call(Faker);
        };
    }
}


export class FakedList extends SchemaDirectiveVisitor {

    static mockListTypes: Record<string, any> = {};

    public visitFieldDefinition(field: GraphQLField<any, any>, details: { objectType: GraphQLObjectType | GraphQLInterfaceType }): GraphQLField<any, any> | void | null {
        const typeName = details.objectType.name;
        const {min, max, p_add, p_delete} = this.args;
        const typeHash = (FakedList.mockListTypes[typeName] = FakedList.mockListTypes[typeName] || {});

        // this MockList definition is picked up in the schema creation and tell the Apollo mocking logic
        // what (random) size list to create if/when mock data needs to be generated
        typeHash[field.name] = () => {
            return new MockList([min, max]);
        };

        // the list resolver is really already handled by the MockList above, *But*, I do get to see exactly where in
        // a query this list is and I can create a couple of list morph instances that can be used to randomly
        // "perturb" the data
        field.resolve = async function (source, args, context, info: GraphQLResolveInfo) {
            const pathToList = wildJsonPath(info.path);
            const query = info.operation.loc ? info.operation.loc.source.body : context['originalQuery'];

            if ( !Morph.hasMorph("add:" + pathToList) ) {
                // The ListAddElementMorph needs to be able to create *new* data as part of morphing. It does so by
                // issuing a query. Which sounds dangerously recursive but it isn't - morphing happens *after* an
                // initial query has completed and we are generating new morphs applied to the original query.
                new ListAddElementMorph(p_add, "add:" + pathToList, pathToList, max, async () => {
                    return convertToObject(await graphql(info.schema, query)).data;
                });
            }

            if ( !Morph.hasMorph("del:" + pathToList) ) {
                new ListDeleteElementMorph(p_delete, "del:" + pathToList, pathToList, min);
            }
        };
    }
}
