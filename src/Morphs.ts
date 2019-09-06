import {nodes, value} from "jsonpath";

/*
A Morph is an abstraction of an operation that might morph, or mutate, an object. It is used to mock updates to
data in order to simulate "live" data changing over time.
 */
export abstract class Morph {

    static MorphsByName = new Map<string, Morph>();

    protected constructor(
        public readonly threshold: number,  // the probability that this morph will be applied on any given cycle.
        public readonly name: string,       // the name of this morph
        public readonly path: string)       // the json path that determines the sub-objects this morph may be applied to
    {
        // morphs are typically created in GraphQL resolvers ... its OK for them to overwrite each other
        Morph.MorphsByName.set(name, this);
    }

    // Will the morph fire?
    private triggered() {
        const r = Math.random();

        return r < this.threshold
    }

    // Apply all the morphs against the given root - mutates the root!
    static async cycle(root: object) {
        const promises: Promise<void>[] = [];

        this.MorphsByName.forEach(m => {
            nodes(root, m.path)
                .map(r => r.value)
                .forEach((o: object) => {
                    if ( o && m.triggered() ) {
                        promises.push(m.execute(o));
                    }
                })
        });

        await Promise.all(promises);
    }

    // Apply this particular morph against the given data
    abstract execute(o: object): Promise<any>;

    public static hasMorph(name: string) {
        return Morph.MorphsByName.has(name);
    }

    public static reset() {
        this.MorphsByName.clear();
    }
}



export class MorphScalar extends Morph {

    constructor(threshold: number, name: string, path: string, private updater: (subject: object) => Promise<any>) {
        super(threshold, name, path);
    }

    execute(o: object): Promise<any> {
        return this.updater(o);
    }
}


export class ListDeleteElementMorph extends Morph {

    constructor(threshold: number, name: string, path: string, private min: number) {
        super(threshold, name, path)
    }

    execute(o: object): Promise<any> {
        if ( Array.isArray(o) ) {
            const list = o;

            if (list.length > this.min) {
                const index = Math.round(Math.random() * (list.length - 1));

                list.splice(index, 1);
            }
        }

        return Promise.resolve();
    }
}


export class ListAddElementMorph extends Morph {

    private mocked: any;

    constructor(threshold: number, name: string, path: string, private max: number, private mockDataGenerator: () => Promise<any>) {
        super(threshold, name, path);
    }

    public async getMockedElement(): Promise<any> {
        let list: any[] = [];

        while (!list || !list.length) {
            this.mocked = this.mocked || await this.mockDataGenerator();

            list = value(this.mocked, this.path);

            if ( !list || list.length === 0 ) {
                this.mocked = null;
            }
        }

        const element = list[0];

        list.splice(0, 1);

        return element;
    }

    async execute(o: object): Promise<any> {
        if ( Array.isArray(o) ) {
            const list = o;

            if (list.length < this.max) {
                const index = Math.round(Math.random() * list.length);
                const element = await this.getMockedElement();

                list.splice(index, 0, element);
            }
        }
    }
}
