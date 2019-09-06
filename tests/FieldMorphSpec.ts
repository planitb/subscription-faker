import {MorphScalar, Morph} from "../src/Morphs";


describe("FieldMorphSpec", () => {

    beforeEach(() => {
        Morph.reset();
    });

    it("can be created", () => {
        expect(new MorphScalar(0.5, "test", "$.foo.bar", (o) => Promise.resolve()));
    });

    it("can update top level fields", async (done) => {
        const m = new MorphScalar(1, "test", "$", (o) => {
            o["data"]++;
            return Promise.resolve();
        });
        const o = {
            data: 10
        };

        await Morph.cycle(o);
        expect(o).toEqual({data: 11});
        done();
    });

    it("can update nested fields", async (done) => {
        const m = new MorphScalar(1, "test", "$.nested", (o) => {
            o["data"]++;
            return Promise.resolve();
        });
        const o = {
            nested: {data: 10}
        };

        await Morph.cycle(o);
        expect(o).toEqual({nested: {data: 11}});
        done()
    });

    it("can update fields embedded in arrays", async (done) => {
        const m = new MorphScalar(1, "test", "$.nested[*]", (o) => {
            o["data"]++;
            return Promise.resolve();
        });
        const o = {
            nested: [{data: 10}]
        };

        await Morph.cycle(o);
        expect(o).toEqual({nested: [{data: 11}]});
        done();
    });

    it("is benign if applied to non-matching data", async (done) => {
        const m = new MorphScalar(1, "test", "$.nested[*]", (o) => {
            o["data"]++;
            return Promise.resolve();
        });
        const o = {
            foo: [{bar: 10}]
        };

        await Morph.cycle(o);
        expect(o).toEqual({foo: [{bar: 10}]});
        done();
    });

    it("its threshold reflects how often it is applied ... maybe never", async (done) => {
        const m = new MorphScalar(0, "test", "$", (o) => {
            o["data"]++;
            return Promise.resolve();
        });
        const o = {
            data: 10
        };

        for(let n = 0; n < 100; n++) {
            await Morph.cycle(o);
        }

        expect(o).toEqual({data: 10});
        done();
    });

    it("its threshold reflects how often it is applied", async (done) => {
        const m = new MorphScalar(0.5, "test", "$", (o) => {
            o["data"]++;
            return Promise.resolve();
        });
        const o = {
            data: 0
        };

        let r = false;
        let callCount = 0;
        const oldRandom = Math.random;
        spyOn(Math, "random").and.callFake(() => {
            r = !r;
            callCount++;
            return r ? 1 : 0;
        });

        for(let n = 0; n < 100; n++) {
            await Morph.cycle(o);
        }

        expect(callCount).toEqual(100);
        expect(o).toEqual({data: 50});

        Math.random = oldRandom;

        done();
    });

    it("can update multiple fields", async (done) => {
        const m = new MorphScalar(1, "test", "$.nested[*]", (o) => {
            o["bar"]++;
            return Promise.resolve();
        });
        const o = {
            nested: [{bar: 10}, {bar: 20}]
        };

        await Morph.cycle(o);
        expect(o).toEqual({nested: [{bar: 11}, {bar: 21}]});
        done();
    });
});
