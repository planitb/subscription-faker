import {PubSubEngine} from "graphql-subscriptions";
import {graphql, GraphQLSchema} from "graphql";
import {convertToObject} from "./utils";
import {Morph} from "./Morphs";



export class PubSubWrapper extends PubSubEngine {
    private intervalsByName: Record<string, NodeJS.Timeout> = {};
    private subscriberRefCounts: Record<string, number> = {};
    private subIdToTriggerName: Record<number, string> = {};
    private iteratorsByTrigger: Record<string, AsyncIterator<any>> = {};

    constructor(private ps: PubSubEngine, private subscriptionSeedSchema: GraphQLSchema, private period: number) {
        super();
    }

    publish(triggerName: string, payload: any): Promise<void> {
        return this.ps.publish(triggerName, payload);
    }

    async subscribe(triggerName: string, onMessage: Function, options: Object): Promise<number> {
        const subId = await this.ps.subscribe(triggerName, onMessage, options);

        this.subIdToTriggerName[subId] = triggerName;

        return subId;
    }

    asyncIterator<T>(triggers: string): AsyncIterator<T> {
        const it = this.ps.asyncIterator<T>(triggers);

        this.iteratorsByTrigger[triggers] = it;

        return it;
    }

    unsubscribeAll() {
        Object.values(this.iteratorsByTrigger).forEach(it => {
            if ( it.return ) {
                it.return().then();
            }
        });
        Object.values(this.intervalsByName).forEach(timer => clearInterval(timer));
        Object.keys(this.subIdToTriggerName).forEach(subId => this.ps.unsubscribe(+subId));
        this.intervalsByName = {};
        this.subscriberRefCounts = {};
        this.subIdToTriggerName = {};
    }

    unsubscribe(subId: number): any {
        const triggerName = this.subIdToTriggerName[subId];
        this.subscriberRefCounts[triggerName]--;

        if ( !this.subscriberRefCounts[triggerName] ) {
            clearInterval(this.intervalsByName[triggerName]);
            delete this.intervalsByName[triggerName];
            delete this.subscriberRefCounts[triggerName];
            delete this.iteratorsByTrigger[triggerName];

            if ( this.subIdToTriggerName[subId] ) {
                delete this.subIdToTriggerName[subId];

                return this.ps.unsubscribe(subId);
            }
        }

        return null;
    }

    async ensurePublishing(subscription: string, fieldName: string) {
        if ( this.intervalsByName[fieldName] ) {
            this.subscriberRefCounts[fieldName]++;
            return null;
        }

        const seed = convertToObject(await graphql(this.subscriptionSeedSchema, subscription));

        this.subscriberRefCounts[fieldName] = 1;
        this.intervalsByName[fieldName] = setInterval(() => {
            Morph.cycle(seed.data)
                .then(() => {
                    return this.publish(fieldName, seed.data);
                })
                .catch(err => console.error(err));
        }, this.period * 1000);

        return seed;
    }
}

